/**
 * schemaUtil 提供echarts doc schema json的各种操作（包括转换成可渲染形式的doc）
 */
define(function (require) {

    /**
     * [schema格式]：
     * {
     *     type: 类型，如'Array', 'Object', 'string', 'Function'，或者['Array', 'string']
     *     descriptionCN: '中文解释文字'
     *     descriptionEN: '英文解释文字'
     *     default:
     *         没有写default字段，因为要从defaultValueHTML转成default工作量比较大得一个个看（因为很多属性不止一个type）
     *     defaultExplanation:
     *         默认值的补充说明片段，有些默认值可能描述为“各异”“自适应”。如果不存在default字段，则会寻找defaultExplanation。
     *     items: 如果type为Array，items描述节点。同json-schema中的定义。
     *     properties: 如果type为Object，properties描述属性。同json-schema中的定义。
     *     definitions: { ... } 同json-schema中的定义。
     *     applicable: {string|Array.<string>}，详见下面applicable说明。
     *     oneOf: { ... } 同json-schema中的定义。暂时不支持 anyOf 和 allOf
     * }
     */

    /**
     * [applicable说明]：
     *
     * applicable是特殊添加的字段，表示axis和series的适用类型，
     * 参见EC_AXIS_APPLICABLE和EC_SERIES_APPLICABLE。
     * 其值可以是string（表示只有一个aplicable），或Array.<string>
     * 如果其值为'all'，表示所有。
     * 在oneOf的各个子项中，如果子项a有applicable: 'all'，子项b有applicable: 'someValue'，则b优先级高。
     * （不过理论上这是业务层面的处理，不是schame该管的范畴，放在这里说明是为了方便。）
     *
     * 在oneOf中，applicable能决定路径的选取，例如：
     * some: {
     *    oneOf: [
     *        {applicable: 'line'},
     *        {applicable: 'pie'}
     *    ]
     * }
     * 如果当前上下文是'pie'，则some取pie作为定义。
     *
     * 在properties中，applicable能决定属性的出现与否，例如：
     * some: {
     *     properties: {
     *         a: {appliable: 'line'},
     *         b: {appliable: 'pie'}
     *     }
     * }
     * 如果当前上下文是'pie'，则some.b出现而some.a不出现。
     */

    // References
    var $ = require('jquery');
    var util = require('./util');
    var Set = require('./Set');

    // Inner constants
    var CODE_INDENT_BASE = 4;
    var LINE_BREAK = '\n';
    var APPLICABLE_ALL = 'all';

    /**
     * @public
     * @type {Object}
     */
    var schemaHelper = {};

    /**
     * ec option中的type枚举
     *
     * @public
     */
    schemaHelper.EC_OPTION_TYPE = ['Array', 'Object', 'string', 'number', 'boolean', 'color', 'Function'];
    /**
     * ec option axis的适用类型枚举
     *
     * @public
     */
    schemaHelper.EC_AXIS_APPLICABLE = ['category', 'value', 'time', 'log'];
    /**
     * ec option series的适用类型枚举
     *
     * @public
     */
    schemaHelper.EC_SERIES_APPLICABLE = [
        'line', 'bar', 'scatter', 'k', 'pie', 'radar', 'chord', 'force', 'map', 'gauge',
        'funnel', 'eventRiver', 'venn', 'treemap', 'tree', 'wordCloud'
    ];
    /**
     * ec option itemStyle的适用类型枚举
     *
     * @public
     */
    schemaHelper.EC_ITEM_STYLE_APPLICABLE = schemaHelper.EC_SERIES_APPLICABLE.concat(
        ['markPoint', 'markLine']
    );

    /**
     * option path 用于在echarts option schema中检索定义内容。
     * 可以返回多个检索结果。
     * schema中每一项都有对应的 option path。
     * 在doc页面中，可以使用 option path 检索到对应的schema项。
     * option path 是类似于这样的东西：
     *
     * 'tooltip.formatter'
     * 'axis[i].symbol'
     *     当路途中有数组时，[i]表示直接进入数组元素定义继续检索。
     * 'series[i](applicable:pie,line).itemStyle.normal.borderColor'
     *     表示，解析到series[i]将当前context中applicable设置成pie。
     *     context中的applicable用于oneOf的选取和properties限定。
     *
     * 为何不使用json ref？因为这些原因，ref不合适用使用。
     * ref中需要有oneOf、properties、items等辅助结构；
     * scheme文档中itemStyle等结构是共用的；
     * 并且考虑ecoption定义中的“适用类型”需求。
     *
     * @public
     * @param {Object} schema
     * @param {string} optionPath option path like 'aaa.bbb.cc'
     * @param {string|Array.<string>} applicable
     * @return {Array.<Object>} result
     */
    schemaHelper.querySchema = function (schema, optionPath) {
        var pathArr = parseOptionPath(optionPath);
        var context = {
            applicable: new Set(),
            originalSchema: schema,
            result: []
        };

        querySchemaRecursively(schema, pathArr, context);
    };

    /**
     * @inner
     */
    function querySchemaRecursively(currSchema, currPathArr, context) {
        if (!util.isObject(currSchema)) {
            return;
        }
        if (!isApplicableInQuery(new Set(currSchema.applicable), context.applicable)) {
            return;
        }

        if (currSchema.oneOf) {
            handleOneOf();
        }
        else if (currSchema['$ref']) {
            handleRef();
        }
        else {
            handleRealItem();
        }

        function handleOneOf() {
            for (var j = 0, lj = currSchema.oneOf.length; j < lj; j++) {
                querySchemaRecursively(
                    currSchema.oneOf[j],
                    currPathArr.slice(),
                    $.extend({}, context, {applicable: context.applicable.clone()})
                );
            }
        }

        function handleRef() {
            querySchemaRecursively(
                schemaHelper.findSchemaItemByRef(context.originalSchema, currSchema['$ref']),
                currPathArr,
                context
            );
        }

        function handleRealItem() {
            if (!currPathArr.length) {
                context.result.push(currSchema);
                return;
            }

            var pathItem = currPathArr[0];
            querySchemaRecursively(
                pathItem.enterArrayItems
                    ? currSchema.items
                    : currSchema.properties[pathItem.propertyName],
                currPathArr.slice(1),
                context
            );
        }
    }

    /**
     * @inner
     */
    function isApplicableInQuery(itemApplicable, contextApplicable) {
        return itemApplicable.contains(APPLICABLE_ALL)
            || itemApplicable.isEmpty()
            || contextApplicable.contains(APPLICABLE_ALL)
            || contextApplicable.isEmpty()
            || contextApplicable.contains(itemApplicable);
    }

    /**
     * @inner
     */
    function parseOptionPath(optionPath) {
        util.assert(!!optionPath);
        var pathArr = optionPath.split(/\.|\[/);
        var retArr = [];

        for (var i = 0, len = pathArr.length; i < len; i++) {
            // match: 'asdf(aaa:bb,cc)' 'i](aaa:bb)' 'asdf' 'i]'
            // 目前只支持了一个context的设置（因为只使用applicable这个context）后续有需要再加。
            var regResult = /^(\w+|i\])(\((\w+):(.+)\))?$/.exec(pathArr[i]) || [];
            var propertyName = regResult[1];
            var ctxVar = regResult[2];
            var ctxVarName = regResult[3];
            var ctxVarValue = regResult[4];

            util.assert(propertyName && (!ctxVar || (ctxVar && ctxVarName && ctxVarValue)));

            var pa = {context: {}};

            if (propertyName === 'i]') {
                pa.enterArrayItems = true;
            }
            else {
                pa.propertyName = propertyName;
            }

            if (ctxVar) {
                if (!pa.context[ctxVarName]) {
                    pa.context[ctxVarName] = new Set();
                }
                pa.context[ctxVarName].reset(ctxVarValue);
            }
            retArr.push(pa);
        }

        return retArr;
    }

    /**
     * Validate schame
     *
     * @public
     */
    schemaHelper.validateSchema = function (schema) {
        var validators = schemaHelper.validators;
        for (var validatorName in validators) {
            if (validators.hasOwnProperty(validatorName)) {
                validators[validatorName](schema);
            }
        }
    };

    /**
     * Schema validators
     *
     * @public
     */
    schemaHelper.validators = {

        // 怕手写笔误，所以统一validate一下。
        validateType: function (schema) {
            schemaHelper.travelSchema(schema, function (o) {
                var typeOfType = $.type(o.type);
                if (typeOfType === 'array') {
                    for (var i = 0, len = o.type.length; i < len; i++) {
                        util.assert(schemaHelper.isValidEcOptionType(o.type[i]));
                    }
                }
                else if (typeOfType === 'string') {
                    util.assert(schemaHelper.isValidEcOptionType(o.type));
                }
                else if (typeof o.type !== 'undefined') {
                    util.assert(false);
                }
            });
        },

        // 检查是不是都有en了
        validateLang: function (schema) {
            schemaHelper.travelSchema(schema, function (o) {
                util.assert(
                    (o.descriptionCN && o.descriptionEN) || (!o.descriptionCN && !o.descriptionEN)
                );
            });
        },

        validatorItem: function (schema) {
            schemaHelper.travelSchema(schema, function (o) {
                util.assert(
                    o.hasOwnProperty('$ref') || o.hasOwnProperty('oneOf') || o.hasOwnProperty('type')
                );
                if (o.hasOwnProperty('$ref')) {
                    // 检查是否所有ref都是正确的
                    util.assert($.isPlainObject(schemaHelper.findSchemaItemByRef(schema, o['$ref'])));
                }
                // 检查如果出现oneOf，那么那个obj中不能有别的属性
                if (o.hasOwnProperty('oneOf')) {
                    util.assert($.isArray(o.oneOf));
                    util.assert(util.onlyHasProperty(o, 'oneOf'));
                }
            });
        }
    };

    /**
     * 遍历schema
     */
    schemaHelper.travelSchema = function (o, callback) {
        callback(o);

        if (o.definitions) {
            travelObj(o.definitions);
        }
        if (o.properties) {
            travelObj(o.properties);
        }
        if (o.items) {
            schemaHelper.travelSchema(o.items, callback);
        }
        if (o.oneOf) {
            travelArr(o.oneOf);
        }

        function travelArr(arr) {
            for (var i = 0; i < arr.length; i++) {
                schemaHelper.travelSchema(arr[i], callback);
            }
        }
        function travelObj(obj) {
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    schemaHelper.travelSchema(obj[key], callback);
                }
            }
        }
    };

    /**
     * 是否合法的type
     */
    schemaHelper.isValidEcOptionType = function (type) {
        return util.contains(schemaHelper.EC_OPTION_TYPE, type);
    };

    /**
     * @return {Array}
     */
    schemaHelper.getEcOptionTypes = function () {
        return util.clone(schemaHelper.EC_OPTION_TYPE);
    };

    /**
     * @public
     * @param {string} ref only support patterns like "#aaa/bbb/ccc"
     * @return {Object}
     */
    schemaHelper.findSchemaItemByRef = function (schema, ref) {
        var refArr = parseRefString(ref);
        var tmp = schema;
        for (var i = 0, len = refArr.length; i < len; i++) {
            tmp = tmp[refArr[i]];
        }
        return tmp;

        function parseRefString(ref) {
            util.assert(ref.indexOf('#') === 0);
            ref = ref.replace('#', '');
            var refArr = ref.split('/');
            util.assert(refArr.length);
            return refArr;
        }
    };

    /**
     * 得到echarts option的字符串形式。
     * ecOption并不是普通的可以json stringify的对象，里面还额外有function、regExp、Date需要处理。
     * 打印效果例如:
     * {
     *      color: '#48b',
     *      width: 2,
     *      type: 'solid'
     * }
     *
     * @public
     * @param {Object} ecOption
     * @return {string} ecOption的字符串
     */
    schemaHelper.stringifyJSObject = function (ecOption) {
        try {
            // 遍历ecOption，将function、regExp、Date字符串化
            var result = schemaHelper.travelJSObject(ecOption, null, 0);
            return result.str;
        }
        catch (e) {
            return '';
        }
    };

    schemaHelper.stringifyJSObject2HTML = function (ecOption) {
        return '<pre>' + schemaHelper.stringifyJSObject(ecOption) + '</pre>';
    };

    /**
     * @inner
     * @throws {Error} If illegal type
     */
    schemaHelper.travelJSObject = function (obj, key, depth) {
        var objType = $.type(obj);
        var codeIndent = (new Array(depth * CODE_INDENT_BASE)).join(' ');
        // 因为为了代码美化，有可能不换行（如[1, 212, 44]），所以由父来添加子的第一个indent。
        var subCodeIndent = (new Array((depth + 1) * CODE_INDENT_BASE)).join(' ');
        var hasLineBreak = false;

        // echarts option 的key目前都是不用加引号的，所以为了编辑方便，统一不加引号。
        var preStr = key != null ? (key + ': ' ) : '';
        var str;

        switch (objType) {
            case 'function':
                hasLineBreak = true;
                str = preStr + util.printFunction(obj, depth, CODE_INDENT_BASE); // FIXME
                break;
            case 'regexp':
                str = preStr + '"' + obj + '"'; // FIXME
                break;
            case 'date':
                str = preStr + '"' + obj + '"'; // FIXME
                break;
            case 'array':
                // array有可能是单行模式，如[12, 23, 34]。
                // 但如果array中子节点有换行，则array就以多行模式渲染。
                var childBuilder = [];
                for (var i = 0, len = obj.length; i < len; i++) {
                    var subResult = schemaHelper.travelJSObject(obj[i], null, depth + 1);
                    childBuilder.push(subResult.str);
                    if (subResult.hasLineBreak) {
                        hasLineBreak = true;
                    }
                }
                var tail = hasLineBreak ? LINE_BREAK : '';
                var delimiter = ',' + (hasLineBreak ? (LINE_BREAK + subCodeIndent) : ' ');
                var subPre = hasLineBreak ? subCodeIndent : '';
                var endPre = hasLineBreak ? codeIndent : '';
                str = ''
                    + preStr + '[' + tail
                    + subPre + childBuilder.join(delimiter) + tail
                    + endPre + ']';
                break;
            case 'object':
                // object全以多行模式渲染（ec option中，object以单行模式渲染更好看的情况不多）。
                hasLineBreak = true;
                var childBuilder = [];
                for (var i in obj) {
                    if (obj.hasOwnProperty(i)
                        // 滤掉图说自定义配置，参见ecHacker
                        && i !== '_show'
                        && i.indexOf('_dt') !== 0
                    ) {
                        var subResult = schemaHelper.travelJSObject(obj[i], i, depth + 1);
                        childBuilder.push(subCodeIndent + subResult.str);
                    }
                }
                str = ''
                    + preStr + '{' + LINE_BREAK
                    + childBuilder.join(',' + LINE_BREAK) + LINE_BREAK
                    + codeIndent + '}';
                break;
            case 'boolean':
            case 'number':
                str = preStr + obj + '';
                break;
            case 'string':
                str = preStr + '"' + obj + '"';
                break;
            default:
                throw new Error('Illegal type "' + objType + '" at "' + obj + '"');
        }

        return {
            str: str,
            hasLineBreak: hasLineBreak
        };
    };

    return schemaHelper;
});