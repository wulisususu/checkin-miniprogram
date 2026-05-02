// pages/logs/logs.js
var config = require('../../config.js');
var app = getApp();

var YEAR_START = 2024;

function pad(n) {
  n = n.toString();
  return n[1] ? n : '0' + n;
}

function fmtTime(isoStr) {
  if (!isoStr) return '';
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

Page({
  data: {
    weekLabels: ['日', '一', '二', '三', '四', '五', '六'],
    // Calendar
    selectedYear: 2026,
    selectedMonth: 5,
    selectedMonthLabel: '05',
    selectedDay: 1,
    calendarCells: [],
    checkedCount: 0,
    calendarAnim: {},
    // Picker
    yearRange: [],
    monthRange: ['01月','02月','03月','04月','05月','06月','07月','08月','09月','10月','11月','12月'],
    pickerValue: [0, 0],
    // Selected day
    selectedDayRecords: [],
    selectedDayLabel: '',
    // Map popup
    mapPopup: {
      show: false,
      latitude: 0,
      longitude: 0,
      markers: [],
      address: '',
      time: ''
    },
    // Admin
    isAdmin: false,
    managedUsers: [],
    selectedUserIndex: 0,
    selectedUserName: '',
    userNames: []
  },

  onLoad: function () {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth() + 1;
    var day = now.getDate();

    var yearRange = [];
    for (var y = YEAR_START; y <= year; y++) yearRange.push(y + '年');

    this.dayRecordsMap = {};

    this.setData({
      selectedYear: year,
      selectedMonth: month,
      selectedMonthLabel: pad(month),
      selectedDay: day,
      yearRange: yearRange,
      pickerValue: [year - YEAR_START, month - 1]
    });
  },

  onShow: function () {
    var isAdmin = app.globalData.isAdmin || false;
    this.setData({ isAdmin: isAdmin });

    if (isAdmin) {
      if (this.data.managedUsers.length === 0) {
        this.loadManagedUsers();
      } else {
        var users = this.data.managedUsers;
        var idx = this.data.selectedUserIndex;
        if (users.length > 0) this.loadAdminCheckins(users[idx].openid);
      }
    } else {
      this.loadRecords();
    }
  },

  // ── Data loading ──────────────────────────────────────────────

  loadRecords: function () {
    var that = this;
    wx.request({
      url: config.checkinUrl,
      method: 'GET',
      data: { openid: app.globalData.openid, limit: 365 },
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.code === 1) {
          that.processRecords(res.data.data || []);
        } else {
          wx.showToast({ title: '加载失败', icon: 'none' });
        }
      },
      fail: function () { wx.showToast({ title: '网络异常', icon: 'none' }); }
    });
  },

  loadManagedUsers: function () {
    var that = this;
    wx.request({
      url: config.adminUsersUrl,
      method: 'GET',
      data: { adminOpenid: app.globalData.openid },
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.code === 1) {
          var raw = res.data.data || [];
          var users = raw.map(function (u) {
            return {
              openid: u.openid,
              nickname: u.nickname || '',
              phone: u.phone || '',
              displayName: u.nickname || u.phone || '未知用户'
            };
          });
          var userNames = users.map(function (u) { return u.displayName; });
          that.setData({
            managedUsers: users,
            userNames: userNames,
            selectedUserIndex: 0,
            selectedUserName: users.length > 0 ? users[0].displayName : '暂无账号'
          });
          if (users.length > 0) {
            that.loadAdminCheckins(users[0].openid);
          } else {
            that.processRecords([]);
          }
        } else {
          wx.showToast({ title: '加载用户失败', icon: 'none' });
        }
      },
      fail: function () { wx.showToast({ title: '网络异常', icon: 'none' }); }
    });
  },

  loadAdminCheckins: function (openid) {
    var that = this;
    wx.request({
      url: config.adminCheckinsUrl,
      method: 'GET',
      data: { adminOpenid: app.globalData.openid, openid: openid, limit: 365 },
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.code === 1) {
          that.processRecords(res.data.data || []);
        } else {
          wx.showToast({ title: '加载记录失败', icon: 'none' });
        }
      },
      fail: function () { wx.showToast({ title: '网络异常', icon: 'none' }); }
    });
  },

  // ── Record processing ─────────────────────────────────────────

  processRecords: function (rawData) {
    var map = {};
    rawData.forEach(function (item) {
      var d = new Date(item.checkin_time);
      var valid = !isNaN(d.getTime());
      if (!valid) return;
      var year = d.getFullYear();
      var month = d.getMonth() + 1;
      var day = d.getDate();
      var dateKey = year + '-' + pad(month) + '-' + pad(day);
      var rec = {
        id: item.id,
        checkinTime: fmtTime(item.checkin_time),
        dateKey: dateKey,
        address: item.address || '暂无地址',
        photo: item.photo_url,
        latitude: Number(item.latitude) || 0,
        longitude: Number(item.longitude) || 0
      };
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(rec);
    });
    this.dayRecordsMap = map;
    this.buildCalendar(this.data.selectedYear, this.data.selectedMonth);
  },

  // ── Calendar ──────────────────────────────────────────────────

  buildCalendar: function (year, month) {
    var now = new Date();
    var todayY = now.getFullYear();
    var todayM = now.getMonth() + 1;
    var todayD = now.getDate();

    var map = this.dayRecordsMap || {};
    var monthKey = year + '-' + pad(month);
    var checkedInMonth = {};
    var checkedCount = 0;
    Object.keys(map).forEach(function (k) {
      if (k.substring(0, 7) === monthKey) {
        checkedInMonth[parseInt(k.substring(8), 10)] = true;
        checkedCount++;
      }
    });

    var daysInMonth = new Date(year, month, 0).getDate();
    var selectedDay = this.data.selectedDay;
    if (!selectedDay || selectedDay > daysInMonth) selectedDay = daysInMonth;

    var startDow = new Date(year, month - 1, 1).getDay();
    var cells = [];
    for (var idx = 0; idx < 42; idx++) {
      var offset = idx - startDow;
      var cd = new Date(year, month - 1, 1 + offset);
      var cy = cd.getFullYear(), cm = cd.getMonth() + 1, cday = cd.getDate();
      var inMonth = cy === year && cm === month;
      var dateKey = cy + '-' + pad(cm) + '-' + pad(cday);
      cells.push({
        day: cday,
        dateKey: dateKey,
        inMonth: inMonth,
        today: cy === todayY && cm === todayM && cday === todayD,
        selected: inMonth && cday === selectedDay,
        checked: inMonth && !!checkedInMonth[cday]
      });
    }

    var selKey = year + '-' + pad(month) + '-' + pad(selectedDay);
    this.setData({
      selectedYear: year,
      selectedMonth: month,
      selectedMonthLabel: pad(month),
      selectedDay: selectedDay,
      calendarCells: cells,
      checkedCount: checkedCount,
      pickerValue: [year - YEAR_START, month - 1],
      selectedDayRecords: map[selKey] || [],
      selectedDayLabel: year + '年' + pad(month) + '月' + pad(selectedDay) + '日'
    });
  },

  animateToMonth: function (year, month) {
    var that = this;
    var out = wx.createAnimation({ duration: 140, timingFunction: 'ease-in' });
    out.opacity(0).step();
    this.setData({ calendarAnim: out.export() });
    setTimeout(function () {
      that.buildCalendar(year, month);
      var inAnim = wx.createAnimation({ duration: 220, timingFunction: 'ease-out' });
      inAnim.opacity(1).step();
      that.setData({ calendarAnim: inAnim.export() });
    }, 150);
  },

  prevMonth: function () {
    var y = this.data.selectedYear, m = this.data.selectedMonth;
    if (m === 1) { y--; m = 12; } else { m--; }
    if (y < YEAR_START) return;
    this.animateToMonth(y, m);
  },

  nextMonth: function () {
    var y = this.data.selectedYear, m = this.data.selectedMonth;
    if (m === 12) { y++; m = 1; } else { m++; }
    var now = new Date();
    if (y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1)) return;
    this.animateToMonth(y, m);
  },

  onPickerChange: function (e) {
    var val = e.detail.value;
    var year = YEAR_START + val[0];
    var month = val[1] + 1;
    var now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1)) return;
    this.animateToMonth(year, month);
  },

  onDayTap: function (e) {
    var ds = e.currentTarget.dataset;
    if (!ds.inMonth) return;
    var day = ds.day;
    var year = this.data.selectedYear;
    var month = this.data.selectedMonth;
    var selKey = year + '-' + pad(month) + '-' + pad(day);
    var map = this.dayRecordsMap || {};

    var cells = this.data.calendarCells.map(function (cell) {
      return {
        day: cell.day,
        dateKey: cell.dateKey,
        inMonth: cell.inMonth,
        today: cell.today,
        selected: cell.inMonth && cell.day === day,
        checked: cell.checked
      };
    });

    this.setData({
      selectedDay: day,
      calendarCells: cells,
      selectedDayRecords: map[selKey] || [],
      selectedDayLabel: year + '年' + pad(month) + '月' + pad(day) + '日'
    });
  },

  // ── Other ─────────────────────────────────────────────────────

  clearRecords: function () {
    var that = this;
    wx.showModal({
      title: '清空记录',
      content: '确定清空所有打卡记录吗？',
      success: function (res) {
        if (!res.confirm) return;
        wx.request({
          url: config.checkinUrl + '?openid=' + encodeURIComponent(app.globalData.openid),
          method: 'DELETE',
          success: function (resp) {
            if (resp.statusCode >= 200 && resp.statusCode < 300 && resp.data && resp.data.code === 1) {
              that.dayRecordsMap = {};
              that.buildCalendar(that.data.selectedYear, that.data.selectedMonth);
            } else {
              wx.showToast({ title: '清空失败', icon: 'none' });
            }
          },
          fail: function () { wx.showToast({ title: '网络异常', icon: 'none' }); }
        });
      }
    });
  },

  onUserPickerChange: function (e) {
    var idx = Number(e.detail.value);
    var users = this.data.managedUsers;
    if (idx < 0 || idx >= users.length) return;
    this.setData({ selectedUserIndex: idx, selectedUserName: users[idx].displayName });
    this.loadAdminCheckins(users[idx].openid);
  },

  showMap: function (e) {
    var ds = e.currentTarget.dataset;
    var lat = Number(ds.lat);
    var lng = Number(ds.lng);
    if (!lat || !lng) {
      wx.showToast({ title: '暂无位置信息', icon: 'none' });
      return;
    }
    var addr = ds.addr || '打卡位置';
    this.setData({
      mapPopup: {
        show: true,
        latitude: lat,
        longitude: lng,
        address: addr,
        time: ds.time || '',
        markers: [{
          id: 1,
          latitude: lat,
          longitude: lng,
          width: 40,
          height: 40,
          callout: {
            content: addr,
            color: '#1c1c1e',
            fontSize: 13,
            borderRadius: 8,
            bgColor: '#ffffff',
            padding: 10,
            display: 'ALWAYS',
            borderWidth: 1,
            borderColor: '#d1d1d6'
          }
        }]
      }
    });
  },

  hideMap: function () {
    this.setData({ 'mapPopup.show': false });
  },

  previewImage: function (e) {
    var url = e.currentTarget.dataset.url;
    wx.previewImage({ current: url, urls: [url] });
  }
});
