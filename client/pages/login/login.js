var app = getApp();
var config = require('../../config.js');

Page({
  data: {
    nickname: '',
    loading: false
  },

  onLoad: function () {
    if (app.globalData.openid) {
      wx.switchTab({ url: '/pages/checkIn/checkIn' });
    }
  },

  onNicknameInput: function (e) {
    this.setData({ nickname: e.detail.value });
  },

  onGetPhoneNumber: function (e) {
    var detail = e.detail || {};
    var ok = (detail.errno === 0) ||
      (detail.errMsg && detail.errMsg.indexOf(':ok') > -1);

    if (!ok || !detail.code) {
      wx.showToast({ title: '需要授权手机号才能登录', icon: 'none', duration: 1500 });
      return;
    }

    var that = this;
    var phoneCode = detail.code;
    var nickname = (this.data.nickname || '').trim() || '微信用户';
    this.setData({ loading: true });

    wx.login({
      success: function (loginRes) {
        wx.request({
          url: config.loginUrl,
          method: 'POST',
          header: { 'Content-Type': 'application/json' },
          data: {
            loginCode: loginRes.code,
            phoneCode: phoneCode,
            nickname: nickname
          },
          success: function (res) {
            var d = res.data || {};
            if (res.statusCode >= 200 && res.statusCode < 300 && d.code === 1) {
              app.globalData.openid = d.data.openid;
              app.globalData.phone = d.data.phone || '';
              app.globalData.nickname = nickname;
              app.globalData.isAdmin = !!d.data.isAdmin;
              wx.setStorageSync('wx_openid', d.data.openid);
              wx.setStorageSync('wx_phone', d.data.phone || '');
              wx.setStorageSync('wx_nickname', nickname);
              wx.setStorageSync('wx_is_admin', !!d.data.isAdmin);
              wx.switchTab({ url: '/pages/checkIn/checkIn' });
            } else {
              wx.showToast({ title: '登录失败，请重试', icon: 'none' });
              that.setData({ loading: false });
            }
          },
          fail: function () {
            wx.showToast({ title: '网络错误', icon: 'none' });
            that.setData({ loading: false });
          }
        });
      },
      fail: function () {
        wx.showToast({ title: '微信登录失败', icon: 'none' });
        that.setData({ loading: false });
      }
    });
  }
});
