/**
 * @file Common util methods.
 */
define(function (require) {

    var util = {};

    extend(
        util,

        // helpers
        require('./util/base'),
        require('./util/json'),
        require('./util/dataDriven'),
        require('./util/objectAccess'),
        require('./util/objectOriented'),
        require('./util/model'),
        require('./util/event'),
        require('./util/enumeration'),
        require('./util/tooltip'),
        require('./util/disable'),
        require('./util/number'),
        require('./util/throttle'),
        require('./util/htmlCleaner'),
        require('./util/others')
    );

    /**
     * @inner
     * @throws {Error} If key duplicate
     */
    function extend(target) {
        for (var i = 1, len = arguments.length; i < len; i++) {
            var source = arguments[i];
            for (var key in source) {
                if (source.hasOwnProperty(key)) {
                    if (target[key]) {
                        // Check duplicate
                        throw new Error('Duplicate key: ' + key);
                    }
                    target[key] = source[key];
                }
            }
        }

        return target;
    }

    return util;
});
