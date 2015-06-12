/**
 * 一些业务无关的帮助函数
 */
define(function (require) {

    var $ = require('jquery');
    var arrProtoIndexOf = Array.prototype.indexOf;

    /**
     * @public
     * @type {Object}
     */
    var util = {};

    /**
     * 打印函数（这个实现不保证浏览器兼容，不保证效果完全好，只是chrome、ff能看）
     *
     * @public
     * @param {Function} fn 方法
     * @param {number} indent 缩进层级
     * @param {number} indentBase 每层级空格数
     * @return {string} 函数字符串
     */
    util.printFunction = function (fn, indent, indentBase) {
        var indentStr = (new Array((indent + 1) * indentBase)).join(' ');
        var fnArr = (fn + '').split('\n');
        var last = '';
        // 处理最后一个“}”
        if (fnArr.length > 1 && $.trim(fnArr[fnArr.length - 1]) === '}') {
            fnArr.pop();
            last = '\n' + (new Array(indent * indentBase)).join(' ') + '}';
        }
        return fnArr.join('\n' + indentStr) + last;
    };

    /**
     * clone object or array
     */
    util.clone = function (src) {
        if ($.isPlainObject(src)) {
            return $.extend(true, {}, src);
        }
        else if ($.isArray(src)) {
            return $.extend(true, [], src);
        }
        util.assert(false);
    };

    /**
     * @public
     * @param {string} data
     * @return {Object|Array}
     */
    util.parseToObject = function (data) {
        // 不检测用户输入是否正确
        var result = (new Function("return (" + data + ")"))();
        var type = $.type(result);
        util.assert(type === 'object' || type === 'array');
        return result;
    };

    /**
     * Is js object.
     */
    util.isObject = function (o) {
        return Object(o) === o;
    };

    /**
     * Does an array contains an item
     */
    util.contains = function (array, item) {
        return util.arrayIndexOf(array, item) !== -1;
    };

    /**
     * 得到从前向后第一次匹配的项的index。也可用于判断item是否在array中。
     *
     * @public
     * @param {Array} array
     * @param {*} item 要判断的项
     * @param {string=} key 如果传此项，表示array的每项是对象，判断每项的key域是否有item。
     *                      如果缺省此项，则判断array的每项是否是item。
     * @return {number} index，如果没找到，返回-1。
     */
    util.arrayIndexOf = function (array, item, key) {
        if (!array) {
            return -1;
        }
        if (arguments.length < 3 && typeof arrProtoIndexOf === 'function') {
            return arrProtoIndexOf.call(array, item);
        }
        for (var i = 0, len = array.length; i < len; i++) {
            if (
                (arguments.length < 3 && array[i] === item)
                || (util.isObject(array[i]) && array[i][key] === item)
            ) {
                return i;
            }
        }
        return -1;
    };

    /**
     * @public
     * @param {Object} obj targe object
     * @param {string} property only has this property
     * @return {boolean}
     */
    util.onlyHasProperty = function (obj, property) {
        var ret = true;
        for (var key in obj) {
            if (obj.hasOwnProperty(key) && key !== property) {
                ret = false;
            }
        }
        return ret;
    };

    /**
     * For fail fast
     *
     * @param  {*} expr
     */
    util.assert = function (expr) {
        if (!expr) {
            throw new Error(expr);
        }
    };

    return util;
});