// pages/user/user.js
var config = require('../../config.js');
var app = getApp();

Page({
  data: {
    avator_path: '../../image/avator.jpg',
    phone: '',
    shortId: '',
    phoneLoading: false
  },

  onShow: function () {
    var openid = app.globalData.openid || '';
    var phone = app.globalData.phone || '';
    this.setData({
      avator_path: app.globalData.avator_url || '../../image/avator.jpg',
      phone: phone,
      shortId: openid ? openid.slice(-8) : '—'
    });
  },

  changeAvator: function () {
    var that = this;
    var fs = wx.getFileSystemManager();
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: function (res) {
        var tempPath = res.tempFilePaths[0];
        fs.saveFile({
          tempFilePath: tempPath,
          success: function (saveRes) {
            app.globalData.avator_url = saveRes.savedFilePath;
            wx.setStorageSync('user_avatar', saveRes.savedFilePath);
            that.setData({ avator_path: saveRes.savedFilePath });
          },
          fail: function () {
            app.globalData.avator_url = tempPath;
            wx.setStorageSync('user_avatar', tempPath);
            that.setData({ avator_path: tempPath });
          }
        });
      }
    });
  },

  onGetPhoneNumber: function (e) {
    var detail = e.detail || {};
    var ok = (detail.errno === 0) ||
      (detail.errMsg && detail.errMsg.indexOf(':ok') > -1);

    if (!ok || !detail.code) {
      wx.showToast({ title: '授权失败', icon: 'none' });
      return;
    }

    var that = this;
    var openid = app.globalData.openid;
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    this.setData({ phoneLoading: true });
    wx.request({
      url: config.phoneUrl,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { phoneCode: detail.code, openid: openid },
      success: function (res) {
        var d = res.data || {};
        if (res.statusCode >= 200 && res.statusCode < 300 && d.code === 1) {
          var phone = d.data.phone;
          app.globalData.phone = phone;
          wx.setStorageSync('wx_phone', phone);
          that.setData({ phone: phone, phoneLoading: false });
          wx.showToast({ title: '手机号已更新', icon: 'success' });
        } else {
          wx.showToast({ title: '更新失败', icon: 'none' });
          that.setData({ phoneLoading: false });
        }
      },
      fail: function () {
        wx.showToast({ title: '网络错误', icon: 'none' });
        that.setData({ phoneLoading: false });
      }
    });
  }
});
