var url = 'https://YOUR_DOMAIN/checkin-api'

module.exports = {
    url:              url,
    checkinUrl:       url + '/api/checkins',
    checkinHealthUrl: url + '/api/health',
    loginUrl:         url + '/api/auth/login',
    phoneUrl:         url + '/api/auth/phone',
    adminUsersUrl:    url + '/api/admin/users',
    adminCheckinsUrl: url + '/api/admin/checkins'
}
