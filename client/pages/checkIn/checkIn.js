// pages/checkIn/checkIn.js
var config = require('../../config.js');
var app = getApp();
var QQMapWX = require('../../libs/qqmap-wx-jssdk.js');
var qqMap = new QQMapWX({
  key: 'YOUR_QQMAP_KEY'
});

// Haversine distance in metres between two lat/lng points
function calcDistance(lat1, lng1, lat2, lng2) {
  var R = 6378137;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Page({
  data: {
    activity_title: '定位打卡',
    photo: '../../image/avator.jpg',
    location_res: '正在定位',
    location_text: '正在获取当前位置',
    address_text: '未获取地址',
    latitude: 0,
    longitude: 0,
    markers: [],
    photo_ready: false,
    location_ready: false
  },

  onLoad: function () {
    this.currentLocation = null;
    this.photoPath = '';
    this.submitting = false;
    this.loadingShown = false;
    this.locationCheck();
  },

  onUnload: function () {
    this.currentLocation = null;
    this.photoPath = '';
    this.submitting = false;
    this.loadingShown = false;
  },

  photoCheck: function () {
    var me = this;
    var fs = wx.getFileSystemManager();
    function handlePhotoPath(tempPath) {
      fs.saveFile({
        tempFilePath: tempPath,
        success: function (saveRes) {
          me.photoPath = saveRes.savedFilePath;
          me.setData({ photo: saveRes.savedFilePath, photo_ready: true });
        },
        fail: function () {
          me.photoPath = tempPath;
          me.setData({ photo: tempPath, photo_ready: true });
        }
      });
    }

    function compressAndStore(tempPath) {
      if (wx.compressImage) {
        wx.compressImage({
          src: tempPath,
          quality: 70,
          success: function (compressRes) {
            handlePhotoPath(compressRes.tempFilePath || tempPath);
          },
          fail: function () {
            handlePhotoPath(tempPath);
          }
        });
      } else {
        handlePhotoPath(tempPath);
      }
    }

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera'],
        camera: 'front',
        success: function (res) {
          var tempPath = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath;
          if (tempPath) compressAndStore(tempPath);
        },
        fail: function (err) {
          console.error('chooseMedia fail:', err);
          wx.showToast({ title: '拍照失败', icon: 'none' });
        }
      });
      return;
    }

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera'],
      success: function (res) {
        compressAndStore(res.tempFilePaths[0]);
      },
      fail: function (err) {
        console.error('chooseImage fail:', err);
        wx.showToast({ title: '拍照失败', icon: 'none' });
      }
    });
  },

  lookupAddress: function (latitude, longitude, callback) {
    // Use cached address if moved less than 100 m
    var cache = app.globalData.geocoderCache;
    if (cache.lat !== null && cache.address &&
        calcDistance(latitude, longitude, cache.lat, cache.lng) < 100) {
      callback(cache.address);
      return;
    }

    qqMap.reverseGeocoder({
      location: {
        latitude: latitude,
        longitude: longitude
      },
      get_poi: 1,
      poi_options: 'policy=2;radius=1500;page_size=20;page_index=1',
      success: function (res) {
        var result = res.result || {};
        var addr = '';
        var reference = result.address_reference || {};
        var component = result.address_component || {};
        var poi = result.pois && result.pois.length > 0 ? result.pois[0] : null;

        if (reference.landmark_l2 && reference.landmark_l2.title) {
          addr = reference.landmark_l2.title + '附近';
        }
        if (!addr && reference.street && reference.street.title) {
          addr = reference.street.title + '附近';
        }
        if (!addr && poi && poi.title) {
          addr = poi.title + '附近';
        }
        if (!addr && result.formatted_addresses && result.formatted_addresses.standard_address) {
          addr = result.formatted_addresses.standard_address;
        }
        if (!addr && result.formatted_addresses && result.formatted_addresses.recommend) {
          addr = result.formatted_addresses.recommend;
        }
        if (!addr && result.address && result.address.indexOf('附近') === -1) {
          addr = result.address;
        }
        if (!addr && (component.province || component.city || component.district || component.street || component.street_number)) {
          addr = (component.province || '') + (component.city || '') + (component.district || '') + (component.street || '') + (component.street_number || '');
        }
        if (!addr) {
          addr = '当前位置';
        }
        app.globalData.geocoderCache = { lat: latitude, lng: longitude, address: addr };
        callback(addr);
      },
      fail: function (err) {
        console.error('reverseGeocoder fail:', err);
        callback('当前位置');
      }
    });
  },

  locationCheck: function () {
    var that = this;

    function requestLocation() {
      wx.getLocation({
        type: 'gcj02',
        success: function (res) {
          that.currentLocation = {
            latitude: res.latitude,
            longitude: res.longitude
          };
          that.setData({
            latitude: res.latitude,
            longitude: res.longitude,
            markers: [{ id: 0, latitude: res.latitude, longitude: res.longitude, width: 32, height: 32 }],
            location_res: '定位成功',
            location_text: '正在解析中文地址',
            address_text: '正在解析中文地址',
            location_ready: false
          });
          that.lookupAddress(res.latitude, res.longitude, function (addr) {
            that.setData({
              location_text: addr,
              address_text: addr,
              location_ready: true
            });
          });
        },
        fail: function (err) {
          console.error('getLocation fail:', err);
          that.setData({
            location_res: '定位失败',
            location_ready: false,
            location_text: '请先开启定位权限',
            address_text: '请先开启定位权限'
          });
          wx.showToast({ title: '请先允许定位', icon: 'none' });
        }
      });
    }

    wx.getSetting({
      success: function (res) {
        var auth = res.authSetting || {};
        if (auth['scope.userLocation'] === false) {
          wx.showModal({
            title: '需要定位权限',
            content: '请在设置里打开定位权限后再试。',
            confirmText: '去设置',
            success: function (modalRes) {
              if (!modalRes.confirm) return;
              wx.openSetting({
                success: function (settingRes) {
                  if (settingRes.authSetting && settingRes.authSetting['scope.userLocation']) {
                    requestLocation();
                  } else {
                    that.setData({ location_res: '定位失败', location_ready: false });
                  }
                }
              });
            }
          });
          return;
        }
        if (auth['scope.userLocation'] === true) {
          requestLocation();
          return;
        }
        wx.authorize({
          scope: 'scope.userLocation',
          success: function () {
            requestLocation();
          },
          fail: function () {
            wx.showModal({
              title: '需要定位权限',
              content: '请在设置里打开定位权限后再试。',
              confirmText: '去设置',
              success: function (modalRes) {
                if (!modalRes.confirm) return;
                wx.openSetting({
                  success: function (settingRes) {
                    if (settingRes.authSetting && settingRes.authSetting['scope.userLocation']) {
                      requestLocation();
                    } else {
                      that.setData({ location_res: '定位失败', location_ready: false });
                    }
                  }
                });
              }
            });
          }
        });
      },
      fail: function () {
        wx.showToast({ title: '定位权限检查失败', icon: 'none' });
      }
    });
  },

  submitCheck: function () {
    var that = this;
    if (!this.data.photo_ready || !this.data.location_ready) {
      wx.showToast({ title: '请先拍照并定位', icon: 'none', duration: 1200 });
      return;
    }
    if (this.submitting) return;
    if (!/^https:\/\//.test(config.checkinUrl)) {
      wx.showToast({ title: '请使用 HTTPS 服务器地址', icon: 'none', duration: 1500 });
      return;
    }

    this.submitting = true;
    this.loadingShown = true;
    wx.showLoading({ title: '提交中', mask: true });

    wx.uploadFile({
      url: config.checkinUrl,
      filePath: this.photoPath,
      name: 'photo',
      formData: {
        openid: app.globalData.openid,
        latitude: String(this.currentLocation.latitude),
        longitude: String(this.currentLocation.longitude),
        address: this.data.address_text || this.data.location_text,
        checkin_time: new Date().toISOString()
      },
      success: function (res) {
        var data = {};
        try { data = JSON.parse(res.data || '{}'); } catch (e) { data = {}; }

        if (res.statusCode >= 200 && res.statusCode < 300 && data.code === 1) {
          wx.showToast({ title: '打卡成功', icon: 'success' });
          that.setData({
            photo: '../../image/avator.jpg',
            location_res: '定位成功',
            location_text: that.data.address_text || '当前位置已记录',
            latitude: that.currentLocation.latitude,
            longitude: that.currentLocation.longitude,
            photo_ready: false,
            location_ready: true
          });
          that.photoPath = '';
          wx.switchTab({ url: '/pages/logs/logs' });
        } else {
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      },
      fail: function (err) {
        console.error('uploadFile fail:', err);
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
      complete: function () {
        that.submitting = false;
        if (that.loadingShown) {
          that.loadingShown = false;
          wx.hideLoading();
        }
      }
    });
  },

  pad: function (n) {
    n = n.toString();
    return n[1] ? n : '0' + n;
  }
});
