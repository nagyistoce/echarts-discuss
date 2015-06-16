/**
 * @file Extra util methods for doc.
 * @author sushuang(sushuang@baidu.com)
 */
define(function (require) {

    var $ = require('jquery');
    var dtUtil = require('dt/util');

    /**
     * @public
     * @type {Object}
     */
    var util = {};

    /**
     * @public
     * @param {string} data
     * @return {Object|Array}
     */
    util.parseToObject = function (data) {
        // 不检测用户输入是否正确
        var result = (new Function('return (' + data + ')'))(); // jshint ignore:line
        var type = $.type(result);
        dtUtil.assert(type === 'object' || type === 'array');
        return result;
    };

    /**
     * @public
     * @param {Array} arr
     * @param {*} item
     * @return {boolean}
     */
    util.contains = function (arr, item) {
        return dtUtil.arrayIndexOf(arr, item) >= 0;
    };

    return util;
});