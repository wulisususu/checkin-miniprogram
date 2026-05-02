"""
Update the remote checkin-app server:
  - uploads src/ and sql/003_add_nickname.sql
  - appends WX_APPID / WX_APPSECRET / ADMIN_PHONE to .env
  - runs the SQL migration
  - restarts the service

Required env vars:
  CHECKIN_PASS   SSH root password
  WX_APPID       WeChat mini-program AppID
  WX_APPSECRET   WeChat mini-program AppSecret
"""

import os
import posixpath
import sys
from pathlib import Path

import paramiko

HOST      = "YOUR_SERVER_IP"
USER      = "root"
APP_DIR   = "/opt/checkin-app"
APP_USER  = "checkin"
APP_GROUP = "checkin"
LOCAL_PROJECT = Path(__file__).resolve().parents[1]
ADMIN_PHONE = os.getenv("ADMIN_PHONE", "YOUR_ADMIN_PHONE")


def run(ssh, cmd, check=True):
    _, stdout, stderr = ssh.exec_command(cmd)
    code = stdout.channel.recv_exit_status()
    out  = stdout.read().decode("utf-8", errors="ignore")
    err  = stderr.read().decode("utf-8", errors="ignore")
    if check and code != 0:
        raise RuntimeError(f"Command failed ({code}): {cmd}\n{out}\n{err}")
    return code, out, err


def ensure_remote_dir(sftp, remote_dir):
    parts   = remote_dir.strip("/").split("/")
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
    print(f"  UP {remote_path}")


def upload_tree(sftp, local_dir: Path, remote_dir: str):
    for root, _, files in os.walk(local_dir):
        root_path = Path(root)
        for name in files:
            local_file = root_path / name
            rel        = local_file.relative_to(local_dir).as_posix()
            upload_file(sftp, local_file, posixpath.join(remote_dir, rel))


def update_env(ssh, wx_appid, wx_appsecret):
    """Append or update WX_APPID / WX_APPSECRET / ADMIN_PHONE in .env."""
    _, current_env, _ = run(ssh, f"cat {APP_DIR}/.env", check=False)
    lines = current_env.splitlines()

    new_vars = {
        "WX_APPID":     wx_appid,
        "WX_APPSECRET": wx_appsecret,
        "ADMIN_PHONE":  ADMIN_PHONE,
    }

    # Update existing lines
    updated_keys = set()
    new_lines = []
    for line in lines:
        key = line.split("=", 1)[0].strip()
        if key in new_vars:
            new_lines.append(f"{key}={new_vars[key]}")
            updated_keys.add(key)
        else:
            new_lines.append(line)

    # Append missing keys
    for key, val in new_vars.items():
        if key not in updated_keys:
            new_lines.append(f"{key}={val}")

    env_content = "\n".join(new_lines) + "\n"
    escaped = env_content.replace("'", "'\"'\"'")
    run(ssh, f"printf '{escaped}' > {APP_DIR}/.env")
    run(ssh, f"chown {APP_USER}:{APP_GROUP} {APP_DIR}/.env")
    print("  OK .env updated with WX_APPID / WX_APPSECRET / ADMIN_PHONE")


def run_sql_migration(ssh):
    sql_file = f"{APP_DIR}/sql/003_add_nickname.sql"
    code, _, _ = run(ssh, f"test -f {sql_file}", check=False)
    if code != 0:
        print("  ! 003_add_nickname.sql not found on server, skipping")
        return
    code, out, err = run(ssh, f"mysql -uroot checkin_prod < {sql_file}", check=False)
    if code == 0:
        print("  OK SQL migration 003_add_nickname applied")
    else:
        # "Column already exists" is fine
        if "Duplicate column" in err or "already exists" in err.lower():
            print("  OK nickname column already exists, skipped")
        else:
            print(f"  ! SQL migration warning: {err.strip()}")


def main():
    password   = os.getenv("CHECKIN_PASS")
    wx_appid   = os.getenv("WX_APPID")
    wx_appsecret = os.getenv("WX_APPSECRET")

    missing = [k for k, v in [("CHECKIN_PASS", password), ("WX_APPID", wx_appid), ("WX_APPSECRET", wx_appsecret)] if not v]
    if missing:
        print("Missing environment variables:", ", ".join(missing))
        print("\nUsage (Windows CMD):")
        print('  set CHECKIN_PASS=your_ssh_password')
        print('  set WX_APPID=your_appid')
        print('  set WX_APPSECRET=your_appsecret')
        print('  python deploy/update_remote.py')
        sys.exit(1)

    print(f"Connecting to {USER}@{HOST} ...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=password, timeout=20)

    try:
        print("\n[1/4] Uploading src/ ...")
        sftp = ssh.open_sftp()
        upload_tree(sftp, LOCAL_PROJECT / "src", f"{APP_DIR}/src")

        print("\n[2/4] Uploading SQL migration ...")
        upload_file(sftp, LOCAL_PROJECT / "sql" / "003_add_nickname.sql",
                    f"{APP_DIR}/sql/003_add_nickname.sql")
        sftp.close()

        print("\n[3/4] Updating .env ...")
        update_env(ssh, wx_appid, wx_appsecret)

        print("\n[4/4] Running SQL migration ...")
        run_sql_migration(ssh)

        print("\nRestarting service ...")
        run(ssh, "systemctl restart checkin-app")

        _, health, _ = run(ssh, "curl -sS http://127.0.0.1:3100/api/health", check=False)
        print(f"Health check: {health.strip()}")
        print("\nDONE Done! The new admin/auth routes are now live.")

    finally:
        ssh.close()


if __name__ == "__main__":
    main()
