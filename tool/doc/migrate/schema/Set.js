/**
 * 一个简易的“集合”
 */
define(function (require) {

    var $ = require('jquery');
    var util = require('./util');

    /**
     * 一个简易的“集合”
     *
     * @public
     * @class
     * @param {string|Array.<string>|Set} value 如'line'，或者['line', 'pie']，或者'line,pie'
     */
    var Set = function (value) {
        this._valueSet = {};
        this.reset(value);
    };

    Set.prototype = {

        /**
         * @public
         * @param {string|Array.<string>|Set} value
         * @return {Set}
         */
        add: function (value) {
            $.extend(this._valueSet, this._normalize(value));
            return this;
        },

        /**
         * @public
         * @param {string|Array.<string>|Set} value
         * @return {Set}
         */
        reset: function (value) {
            this._valueSet = this._normalize(value);
        },

        /**
         * @public
         * @param {string|Array.<string>|Set} value
         * @return {boolean}
         */
        contains: function (value) {
            var inputSet = this._normalize(value);
            for (var key in inputSet) {
                if (inputSet.hasOwnProperty(key) && !this._valueSet[key]) {
                    return false;
                }
            }
            return true;
        },

        /**
         * @public
         * @return {boolean}
         */
        isEmpty: function () {
            return this.count() === 0;
        },

        /**
         * @public
         * @return {number}
         */
        count: function () {
            var count = 0;
            for (var value in this._valueSet) {
                if (this._valueSet.hasOwnProperty(value)) {
                    count++;
                }
            }
            return count;
        },

        /**
         * @pubilc
         * @return {Array.<string>}
         */
        list: function () {
            var set = this._valueSet;
            var list = [];
            for (var key in set) {
                if (set.hasOwnProperty(key)) {
                    list.push(key);
                }
            }
            return list;
        },

        /**
         * @public
         * @return {Set}
         */
        clone: function () {
            return new Set(this);
        },

        /**
         * @inner
         * @param {string|Array.<string>|Set} value
         * @return {Object}
         */
        _normalize: function (value) {
            var set = {};
            var type = $.type(value);

            if (!value) {
                return set;
            }

            if (value instanceof Set) {
                value = value.list();
            }
            else if (type === 'string') {
                value = value.split(',');
            }
            else {
                util.assert(type === 'array');
            }

            for (var i = 0, len = value.length; i < len; i++) {
                set[value[i]] = 1;
            }
            return set;
        }
    };

    Set.prototype.constructor = Set;

    return Set;
});