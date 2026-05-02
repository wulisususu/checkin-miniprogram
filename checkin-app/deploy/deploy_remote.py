import os
import posixpath
import sys
import time
from pathlib import Path

import paramiko


HOST = "YOUR_SERVER_IP"
USER = "root"
APP_DIR = "/opt/checkin-app"
APP_USER = "checkin"
APP_GROUP = "checkin"
APP_PORT = 3100
LOCAL_PROJECT = Path(__file__).resolve().parents[1]
LOCAL_SYNC_FILES = ["package.json", ".env.example", "README.md", "sql", "src", "uploads/.gitkeep"]


def run(ssh, cmd, check=True):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="ignore")
    err = stderr.read().decode("utf-8", errors="ignore")
    if check and code != 0:
        raise RuntimeError(f"Command failed ({code}): {cmd}\nSTDOUT:\n{out}\nSTDERR:\n{err}")
    return code, out, err


def ensure_remote_dir(sftp, remote_dir):
    parts = remote_dir.strip("/").split("/")
    current = "/"
    for p in parts:
        current = posixpath.join(current, p)
        try:
            sftp.stat(current)
        except FileNotFoundError:
            sftp.mkdir(current)


def upload_file(sftp, local_path: Path, remote_path: str):
    ensure_remote_dir(sftp, posixpath.dirname(remote_path))
    sftp.put(str(local_path), remote_path)


def upload_tree(sftp, local_dir: Path, remote_dir: str):
    for root, _, files in os.walk(local_dir):
        root_path = Path(root)
        for name in files:
            local_file = root_path / name
            rel = local_file.relative_to(local_dir).as_posix()
            remote_file = posixpath.join(remote_dir, rel)
            upload_file(sftp, local_file, remote_file)


def detect_pm(ssh):
    for pm in ["apt-get", "dnf", "yum"]:
        code, _, _ = run(ssh, f"command -v {pm}", check=False)
        if code == 0:
            return pm
    return None


def install_node(ssh):
    code, out, _ = run(ssh, "node -v", check=False)
    if code == 0:
        print(f"Node exists: {out.strip()}")
        return
    pm = detect_pm(ssh)
    if pm == "apt-get":
        run(ssh, "apt-get update")
        run(ssh, "apt-get install -y curl ca-certificates gnupg")
        run(ssh, "mkdir -p /etc/apt/keyrings")
        run(
            ssh,
            "curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key "
            "| gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg",
        )
        run(
            ssh,
            "echo 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] "
            "https://deb.nodesource.com/node_20.x nodistro main' "
            "> /etc/apt/sources.list.d/nodesource.list",
        )
        run(ssh, "apt-get update")
        run(ssh, "apt-get install -y nodejs")
    elif pm in ("dnf", "yum"):
        run(ssh, f"{pm} install -y nodejs npm")
    else:
        raise RuntimeError("Unsupported server package manager; install Node.js 20+ manually.")


def upload_project(ssh):
    run(ssh, f"mkdir -p {APP_DIR}/uploads {APP_DIR}/sql {APP_DIR}/src")
    sftp = ssh.open_sftp()
    try:
        for rel in LOCAL_SYNC_FILES:
            local = LOCAL_PROJECT / rel
            remote = posixpath.join(APP_DIR, rel.replace("\\", "/"))
            if local.is_dir():
                upload_tree(sftp, local, remote)
            else:
                upload_file(sftp, local, remote)
    finally:
        sftp.close()


def setup_user_and_permissions(ssh):
    run(ssh, f"getent group {APP_GROUP} >/dev/null || groupadd --system {APP_GROUP}")
    run(
        ssh,
        f"id -u {APP_USER} >/dev/null 2>&1 || "
        f"useradd --system --gid {APP_GROUP} --create-home "
        f"--home-dir /home/{APP_USER} --shell /usr/sbin/nologin {APP_USER}",
    )
    run(ssh, f"chown -R {APP_USER}:{APP_GROUP} {APP_DIR}")


def setup_env(ssh):
    db_password = os.getenv("CHECKIN_DB_PASSWORD", "")
    if not db_password:
        db_password = f"ck_{int(time.time())}_A9!"
    env_text = (
        "NODE_ENV=production\n"
        f"PORT={APP_PORT}\n"
        "DB_HOST=127.0.0.1\n"
        "DB_PORT=3306\n"
        "DB_NAME=checkin_prod\n"
        "DB_USER=checkin_user\n"
        f"DB_PASSWORD={db_password}\n"
        "UPLOAD_DIR=/opt/checkin-app/uploads\n"
        "PUBLIC_BASE_URL=https://YOUR_DOMAIN/checkin-api/api\n"
    )
    escaped = env_text.replace("\\", "\\\\").replace("'", "'\"'\"'")
    run(ssh, f"printf '{escaped}' > {APP_DIR}/.env")
    run(ssh, f"chown {APP_USER}:{APP_GROUP} {APP_DIR}/.env")
    return db_password


def setup_mysql(ssh, db_password):
    code, _, _ = run(ssh, "command -v mysql", check=False)
    if code != 0:
        print("mysql client not found; skipped DB setup. Install MySQL/MariaDB and run SQL manually.")
        return False
    sql = (
        "CREATE DATABASE IF NOT EXISTS checkin_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        "CREATE USER IF NOT EXISTS 'checkin_user'@'127.0.0.1' IDENTIFIED BY '{pwd}';"
        "ALTER USER 'checkin_user'@'127.0.0.1' IDENTIFIED BY '{pwd}';"
        "GRANT ALL PRIVILEGES ON checkin_prod.* TO 'checkin_user'@'127.0.0.1';"
        "FLUSH PRIVILEGES;"
    ).format(pwd=db_password.replace("'", "''"))
    run(ssh, f"mysql -uroot -e \"{sql}\"")
    run(ssh, f"mysql -uroot checkin_prod < {APP_DIR}/sql/001_init.sql")
    return True


def install_dependencies_and_service(ssh):
    run(ssh, f"cd {APP_DIR} && npm install --omit=dev")
    service = f"""[Unit]
Description=Independent Checkin App
After=network.target

[Service]
Type=simple
User={APP_USER}
Group={APP_GROUP}
WorkingDirectory={APP_DIR}
Environment=NODE_ENV=production
ExecStart=/usr/bin/node {APP_DIR}/src/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"""
    escaped = service.replace("\\", "\\\\").replace("'", "'\"'\"'")
    run(ssh, f"printf '{escaped}' > /etc/systemd/system/checkin-app.service")
    run(ssh, "systemctl daemon-reload")
    run(ssh, "systemctl enable checkin-app")
    run(ssh, "systemctl restart checkin-app")
    run(ssh, "systemctl --no-pager --full status checkin-app", check=False)


def main():
    password = os.getenv("CHECKIN_PASS")
    if not password:
        print("Missing env CHECKIN_PASS")
        sys.exit(1)

    print(f"Connecting to {USER}@{HOST} ...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=password, timeout=20)
    try:
        install_node(ssh)
        upload_project(ssh)
        setup_user_and_permissions(ssh)
        db_password = setup_env(ssh)
        db_ok = setup_mysql(ssh, db_password)
        install_dependencies_and_service(ssh)
        _, health_out, health_err = run(
            ssh, f"curl -sS http://127.0.0.1:{APP_PORT}/api/health", check=False
        )
        print("Health response:", (health_out or health_err).strip())
        print("\nDone.")
        print(f"App dir: {APP_DIR}")
        print(f"Service: checkin-app")
        print(f"URL (temporary): https://YOUR_DOMAIN/checkin-api/api/health")
        if db_ok:
            print("Database initialized: checkin_prod / checkin_user@127.0.0.1")
        else:
            print("Database not initialized automatically; manual DB setup still required.")
        print(f"DB password generated and written to {APP_DIR}/.env")
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
