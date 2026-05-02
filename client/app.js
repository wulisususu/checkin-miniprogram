//app.js
var USER_AVATAR_STORAGE_KEY = 'user_avatar';

App({
    onLaunch: function () {
        var logs = wx.getStorageSync('logs') || [];
        logs.unshift(Date.now());
        wx.setStorageSync('logs', logs);

        this.globalData.avator_url = wx.getStorageSync(USER_AVATAR_STORAGE_KEY) || '';
        this.globalData.openid     = wx.getStorageSync('wx_openid')   || '';
        this.globalData.phone      = wx.getStorageSync('wx_phone')    || '';
        this.globalData.nickname   = wx.getStorageSync('wx_nickname') || '';
        // Treat as admin if phone matches OR if the stored flag is set.
        var phone = wx.getStorageSync('wx_phone') || '';
        this.globalData.isAdmin = phone === 'YOUR_ADMIN_PHONE' || !!wx.getStorageSync('wx_is_admin');
    },
    globalData: {
        openid:    '',
        phone:     '',
        nickname:  '',
        isAdmin:   false,
        avator_url: null,
        geocoderCache: { lat: null, lng: null, address: '' }
    }
})
