/**
 * @file Schema related operations.
 * @author sushuang(sushuang@baidu.com)
 */
define(function (require) {

    /**
     * [schema格式]：
     * {
     *     type: 类型，如'Array', 'Object', 'string', 'Function'，或者['Array', 'string']
     *     descriptionCN: '中文解释文字'
     *     descriptionEN: '英文解释文字'
     *     default:
     *         default value字段
     *     defaultExplanation:
     *         默认值的补充说明片段，有些默认值可能描述为“各异”“自适应”。如果不存在default字段，则会寻找defaultExplanation。
     *     items: 如果type为Array，items描述节点。同json-schema中的定义。
     *     properties: 如果type为Object，properties描述属性。同json-schema中的定义。
     *     definitions: { ... } 同json-schema中的定义。
     *     applicable: {string|Array.<string>}，详见下面applicable说明。
     *     oneOf: { ... } 同json-schema中的定义。暂时不支持 anyOf 和 allOf
     *     enumerateBy: ['line', 'pie'] 在文档中，此项下，按照所给出的值设置applicable并列表显示。
     *     setApplicable: ['markPoint', 'markLine'] 在此子树中遍历时，用给定的值设置applicable。
     *     defaultByApplicable: {'line': 'default1', 'pie': 'default2'} doc展示中，根据applicable得到default。
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
    var dtLib = require('dt/lib');

    // Inner constants
    var CODE_INDENT_BASE = 4;
    var LINE_BREAK = '\n';

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
    schemaHelper.EC_OPTION_TYPE = [
        'Array', 'Object', 'string', 'number', 'boolean', 'color', 'Function'
    ];
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
     * option path 用于在 docJsonRenderer 绘制出的doctree中检索定义内容。
     * 可以返回多个检索结果。
     * option path 是类似于这样的东西：
     *
     * 'tooltip.formatter'
     * 'axis[i].symbol'
     *     当路途中有数组时，[i]表示直接进入数组元素定义继续检索。
     * 'series[i](pie,line).itemStyle.normal.borderColor'
     *     表示，解析到series[i]将当前context中applicable设置成pie。
     *     context中的applicable用于oneOf的选取和properties限定。
     *
     * @public
     * @param {Object} docTree
     * @param {Object} args
     * @param {string=} [args.fuzzyPath] Like 'bbb(line,pie).ccc',
     *                                   using fuzzy mode, case insensitive.
     *                                   i.e. The query string above matches the result 'mm.zbbbx.yyy.cccl'.
     * @param {string=} [args.optionPath] Like 'aaa(line,pie).bbb.cc',
     *                                    must be matched accurately, case sensitive.
     * @param {string=} [args.anyText] Like 'somesomesome',
     *                                 using fuzzy mode, case insensitive..
     *                                 full text query (include descriptoin)
     * @return {Array.<Object>} result
     * @throws {Error}
     */
    schemaHelper.queryDocTree = function (docTree, args) {
        args = args || {};
        var context = {
            originalDocTree: docTree,
            result: [],
            optionPath: args.optionPath ? parseOptionPath(args.optionPath, true) : null,
            fuzzyPath: args.fuzzyPath ? parseOptionPath(args.fuzzyPath, true) : null,
            anyText: args.anyText && $.trim(args.anyText) || null
        };

        dtLib.assert(
            (context.optionPath || context.fuzzyPath || context.anyText)
            && (!!context.optionPath && !!context.fuzzyPath) === false,
            'invalid query string!'
        );

        if (context.optionPath || context.fuzzyPath) {
            queryRecursivelyByPath(docTree, context, 0, new dtLib.Set());
        }
        else {
            queryRecursivelyByContent(docTree, context);
        }

        return context.result;

        function queryRecursivelyByPath(docTree, context, pathIndex, applicable) {
            if (!dtLib.isObject(docTree)
                || !isApplicableLoosely(new dtLib.Set(docTree.applicable), applicable)
            ) {
                return;
            }

            var pathItem = (context.optionPath || context.fuzzyPath)[pathIndex];
            if (!pathItem) {
                context.result.push(docTree);
                return;
            }

            var subApplicable = applicable;
            var pathItemApp = pathItem.applicable;
            if (pathItemApp) {
                subApplicable = new dtLib.Set(pathItemApp);
            }

            for (var i = 0, len = (docTree.children || []).length; i < len; i++) {
                var child = docTree.children[i];
                var nextPathIndex;

                if (docTree.isEnumParent) {
                    nextPathIndex = pathIndex;
                }
                else if (context.optionPath
                    && pathAccurateMatch(child, pathItem.propertyName, pathItem.arrayName)
                ) {
                    nextPathIndex = pathIndex + 1;
                }
                else if (context.fuzzyPath) {
                    if (pathFuzzyMatch(child, pathItem.propertyName, pathItem.arrayName)) {
                        nextPathIndex = pathIndex + 1;
                    }
                    else {
                        nextPathIndex = pathIndex;
                    }
                }

                if (nextPathIndex != null) {
                    queryRecursivelyByPath(child, context, nextPathIndex, subApplicable);
                }
            }
        }

        function queryRecursivelyByContent(docTree, context) {
            if (!dtLib.isObject(docTree)) {
                return;
            }

            if (context.anyText
                && (
                    pathFuzzyMatch(docTree, context.anyText)
                    || (docTree.descriptionCN && docTree.descriptionCN.indexOf(context.anyText) >= 0)
                    || (docTree.descriptionCN && docTree.descriptionEN.indexOf(context.anyText) >= 0)
                )
            ) {
                context.result.push(docTree);
                return;
            }

            for (var i = 0, len = (docTree.children || []).length; i < len; i++) {
                queryRecursivelyByContent(docTree.children[i], context);
            }
        }

        function pathAccurateMatch(child, propertyName, arrayName) {
            return (child.propertyName != null && child.propertyName === propertyName)
                || (
                    child.arrayName != null && isMatchArrayName(
                        arrayName != null ? arrayName : propertyName,
                        child.arrayName
                    )
                );
        }

        function pathFuzzyMatch(child, propertyName, arrayName) {
            if (propertyName == null) {
                return;
            }
            if (propertyName != null) {
                propertyName = propertyName.toLowerCase();
            }
            if (arrayName != null) {
                arrayName = arrayName.toLowerCase();
            }
            return (child.propertyName != null
                    && child.propertyName.toLowerCase().indexOf(propertyName) >= 0
                )
                || (child.arrayName != null
                    && child.arrayName.toLowerCase().indexOf(
                        arrayName != null ? arrayName : propertyName
                    ) >= 0
                );
        }

        function isMatchArrayName(nameShort, nameFull) {
            return nameShort && nameFull
                && nameFull.indexOf(nameShort) === 0
                && /^(\[i\])*$/.test(nameFull.slice(nameShort.length));
        }
    };

    /**
     * option path 用于在echarts option schema中检索定义内容。
     * 可以返回多个检索结果。
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
     * @throws {Error}
     */
    schemaHelper.querySchema = function (schema, optionPath) {
        var pathArr = parseOptionPath(optionPath);
        var result = [];
        var context = {
            originalSchema: schema,
            result: result,
            applicable: new dtLib.Set()
        };

        querySchemaRecursively(schema, pathArr, context);

        return result;

        function querySchemaRecursively(schemaItem, currPathArr, context) {
            if (!dtLib.isObject(schemaItem)
                || !isApplicableLoosely(new dtLib.Set(schemaItem.applicable), context.applicable)
            ) {
                return;
            }

            if (schemaItem.oneOf) {
                handleOneOf(schemaItem, currPathArr, context);
            }
            else if (schemaItem['$ref']) {
                handleRef(schemaItem, currPathArr, context);
            }
            else {
                handleRealItem(schemaItem, currPathArr, context);
            }
        }

        function handleOneOf(schemaItem, currPathArr, context) {
            for (var j = 0, lj = schemaItem.oneOf.length; j < lj; j++) {
                querySchemaRecursively(
                    schemaItem.oneOf[j],
                    currPathArr.slice(),
                    context
                );
            }
        }

        function handleRef(schemaItem, currPathArr, context) {
            querySchemaRecursively(
                schemaHelper.findSchemaItemByRef(context.originalSchema, schemaItem['$ref']),
                currPathArr,
                context
            );
        }

        function handleRealItem(schemaItem, currPathArr, context) {
            if (!currPathArr.length) {
                context.result.push(schemaItem);
                return;
            }

            var pathItem = currPathArr[0];

            // Modify applicable by optionPath.
            var originalApplicableValue = context.applicable.list();
            var set = new dtLib.Set();
            set.add(pathItem.applicable);
            set.add(schemaItem.setApplicable);
            if (set.count() > 0) {
                context.applicable.reset(set);
            }

            querySchemaRecursively(
                pathItem.arrayName
                    ? schemaItem.items
                    : schemaItem.properties[pathItem.propertyName],
                currPathArr.slice(1),
                context
            );

            // Restore applicable.
            context.applicable.reset(originalApplicableValue);
        }
    };

    /**
     * @inner
     */
    function isApplicableLoosely(itemApplicable, contextApplicable) {
        return itemApplicable.isEmpty()
            || contextApplicable.isEmpty()
            || contextApplicable.intersects(itemApplicable).count() > 0;
    }

    /**
     * @inner
     */
    function isApplicableStrictly(itemApplicable, contextApplicable) {
        return itemApplicable.isEmpty()
            || contextApplicable.intersects(itemApplicable).count() > 0;
    }

    /**
     * Input: 'asdf(bb,cc)[i](dd,ee).zzz[i][i]. ee() .ff',
     * Output:
     * When arrayOnlyAtom is false: [
     *     {propertyName: 'asdf', applicable: new Set('bb,cc')},
     *     {arrayName: 'asdf[i]', applicable: new Set('dd,ee')},
     *     {propertyName: 'zzz'},
     *     {arrayName: 'zzz[i]'},
     *     {arrayName: 'zzz[i][i]'},
     *     {propertyName: 'ee', applicable: new Set()},
     *     {propertyName: 'ff'}
     * ]
     * When arrayOnlyAtom is true: [
     *     {arrayName: 'asdf[i]', applicable: new Set().reset('bb,cc').reset('dd,ee')},
     *     {arrayName: 'zzz[i][i]'},
     *     {propertyName: 'ee', applicable: new Set()},
     *     {propertyName: 'ff'}
     * ]
     *
     * @inner
     */
    function parseOptionPath(optionPath, arrayOnlyAtom) {
        var errorInfo = 'Path is illegal: \'' + optionPath + '\'';
        dtLib.assert(
            optionPath && (optionPath = $.trim(optionPath)), errorInfo
        );
        var pathArr = optionPath.split(/\.|\[/);
        var retArr = [];

        for (var i = 0, len = pathArr.length; i < len; i++) {
            // match: 'asdf(bb,cc,ee/ff/gg)' 'i](bb)' 'xx()' 'asdf' 'i]'
            var regResult = /^(\w+|i\])(\(([a-zA-Z_ \/,]*)\))?$/.exec($.trim(pathArr[i])) || [];
            dtLib.assert(regResult, errorInfo);

            var propertyName = regResult[1];
            var ctxVar = regResult[2];
            var ctxVarValue = regResult[3];
            var pa = {};
            var lastPa = retArr[retArr.length - 1];

            if (propertyName === 'i]') {
                pa.arrayName = (lastPa.arrayName || lastPa.propertyName) + '[i]';
            }
            else {
                pa.propertyName = propertyName;
            }

            if (ctxVar) {
                pa.applicable = new dtLib.Set(ctxVarValue);
            }
            retArr.push(pa);
        }

        if (arrayOnlyAtom) {
            for (var i = 0, len = retArr.length; i < len;) {
                var thisItem = retArr[i];
                var nextItem = retArr[i + 1];
                if (nextItem && nextItem.arrayName) {
                    if (thisItem.applicable && !nextItem.applicable) {
                        nextItem.applicable = new dtLib.Set(thisItem.applicable);
                    }
                    retArr.splice(i, 1);
                }
                else {
                    i++;
                }
            }
        }

        return retArr;
    }

    /**
     * Build doc by schema.
     * A doc json will be generated, which is different from schema json.
     * Some business rules will be applied when doc being built.
     * For example, the doc of 'series' will be organized by chart type.
     *
     * @public
     * @param {Object} schema
     * @param {Object} renderBase
     * @param {Function} docRenderer params: renderBase, schemaItem, context
     *                               return: subRenderBase (MUST return the object for continue building)
     *                               See schemaHelper.buildDoc.docJsonRenderer.
     *                               The context object contains: {
     *                                   itemName {string},
     *                                   relationInfo {BuildDocInfo},
     *                                   selfInfo {BuildDocInfo},
     *                                   enumInfo: {BuildDocInfo},
     *                                   oneOfInfo: {BuildDocInfo},
     *                                   refFrom {Array.<Object>},
     *                                   arrayFrom {Array.<Object>},
     *                                   applicable: {string|Array.<string>}
     *                               }
     * @param {string} mode Value can be:
     *                      'doc' render doc (default);
     *                      'schema' render original schema;
     */
    schemaHelper.buildDoc = function (schema, renderBase, docRenderer, mode) {
        var applicable = new dtLib.Set();
        docRenderer = docRenderer || schemaHelper.buildDoc.docJsonRenderer;

        buildRecursively(renderBase, schema, makeContext());

        return renderBase;

        function makeContext(props) {
            return $.extend(
                {
                    originalSchema: schema,
                    docRenderer: docRenderer,
                    applicable: applicable,
                    mode: mode || 'doc',
                    isApplicable: mode === 'schema'
                        ? isApplicableLoosely : isApplicableStrictly
                },
                props
            );
        }

        function buildRecursively(renderBase, schemaItem, context) {
            if (!dtLib.isObject(schemaItem)
                || !context.isApplicable(new dtLib.Set(schemaItem.applicable), context.applicable)
            ) {
                return;
            }

            var originalApplicableValue = context.applicable.list();
            // Modify applicable
            // If we use 'applicable.add(...)', we need priority mechanism.
            // For simple, we use 'applicable.reset(...)'.
            // Thus context.applicable always only has zero or one value.
            if (schemaItem.setApplicable) {
                context.applicable.reset(schemaItem.setApplicable);
            }

            if (context.mode === 'doc') {
                if (schemaItem.enumerateBy
                    && context.enumInfo !== BuildDocInfo.IS_ENUM_ITEM
                ) {
                    handleEnumerate(renderBase, schemaItem, context);
                }
                else if (schemaItem.oneOf) {
                    handleOneOfForDocMode(renderBase, schemaItem, context);
                }
                else if (schemaItem['$ref']) {
                    handleRefFocDocMode(renderBase, schemaItem, context);
                }
                else if (schemaItem.items) { // Array
                    handleArray(renderBase, schemaItem, context);
                }
                else if (schemaItem.properties) { // Object and simple type
                    handleObject(renderBase, schemaItem, context);
                }
                else {
                    handlePrimary(renderBase, schemaItem, context);
                }
            }
            else { // context.mode === 'schema'
                if (schemaItem.definitions) {
                    handleDefinitions(renderBase, schemaItem, context);
                }
                else if (schemaItem.oneOf) {
                    handleOneOfForSchemaMode(renderBase, schemaItem, context);
                }
                else if (schemaItem['$ref']) {
                    handleRefFocSchemaMode(renderBase, schemaItem, context);
                }
                else if (schemaItem.items) {
                    handleArray(renderBase, schemaItem, context);
                }
                else if (schemaItem.properties) {
                    handleObject(renderBase, schemaItem, context);
                }
                else {
                    handlePrimary(renderBase, schemaItem, context);
                }
            }

            // Restore applicable
            context.applicable.reset(originalApplicableValue);
        }

        function handleEnumerate(renderBase, schemaItem, context) {
            context.enumInfo = BuildDocInfo.IS_ENUM_PARENT;
            var subRenderBase = context.docRenderer(renderBase, schemaItem, context);

            var enumerateBy = schemaItem.enumerateBy;
            var applicable = context.applicable;
            for (var j = 0, lj = enumerateBy.length; j < lj; j++) {
                // Modify applicable
                var originalApplicableValue = applicable.list();
                applicable.reset(enumerateBy[j]);

                buildRecursively(
                    subRenderBase,
                    schemaItem,
                    makeContext({
                        itemName: context.itemName,
                        relationInfo: context.relationInfo,
                        enumInfo: BuildDocInfo.IS_ENUM_ITEM,
                        refFrom: context.refFrom,
                        arrayFrom: context.arrayFrom
                    })
                );

                // Restore applicable
                applicable.reset(originalApplicableValue);
            }
        }

        function handleDefinitions(renderBase, schemaItem, context) {
            context.selfInfo = BuildDocInfo.IS_DEFINITION_PARENT;
            var subRenderBase = context.docRenderer(renderBase, schemaItem, context);

            var definitions = schemaItem.definitions;
            for (var name in definitions) {
                if (definitions.hasOwnProperty(name)) {
                    buildRecursively(
                        subRenderBase,
                        definitions[name],
                        makeContext({
                            itemName: name,
                            relationInfo: BuildDocInfo.IS_DEFINITION_ITEM
                        })
                    );
                }
            }
        }

        function handleOneOfForDocMode(renderBase, schemaItem, context) {
            var oneOf = schemaItem.oneOf.slice();

            // Find default one.
            var defaultOne;
            for (var i = 0, len = oneOf.length; i < len; i++) {
                if (oneOf[i].applicable == null) {
                    defaultOne = oneOf.splice(i, 1)[0];
                    break;
                }
            }

            // Find applicable one.
            var applicableOne;
            for (var i = 0, len = oneOf.length; i < len; i++) {
                // Only one can be applicable, otherwise schema is illegal.
                if (context.isApplicable(new dtLib.Set(oneOf[i].applicable), context.applicable)) {
                    dtLib.assert(!applicableOne);
                    applicableOne = oneOf[i];
                }
            }

            var one = applicableOne || defaultOne;
            if (one) {
                buildRecursively(
                    renderBase,
                    one,
                    makeContext({
                        itemName: context.itemName,
                        relationInfo: context.relationInfo,
                        refFrom: context.refFrom,
                        arrayFrom: context.arrayFrom
                    })
                );
            }
            else if (context.relationInfo === BuildDocInfo.IS_ENUM_ITEM) {
                // At least one applicable.
                dtLib.assert(false);
            }
        }

        function handleOneOfForSchemaMode(renderBase, schemaItem, context) {
            context.oneOfInfo = BuildDocInfo.IS_ONE_OF_PARENT;
            var subRenderBase = context.docRenderer(renderBase, schemaItem, context);

            var oneOf = schemaItem.oneOf;
            for (var i = 0, len = oneOf.length; i < len; i++) {
                buildRecursively(
                    subRenderBase,
                    oneOf[i],
                    makeContext({
                        itemName: context.itemName,
                        relationInfo: context.relationInfo,
                        refFrom: context.refFrom,
                        oneOfInfo: BuildDocInfo.IS_ONE_OF_ITEM,
                        arrayFrom: context.arrayFrom
                    })
                );
            }
        }

        function handleRefFocDocMode(renderBase, schemaItem, context) {
            var refFrom = context.refFrom;

            buildRecursively(
                renderBase,
                schemaHelper.findSchemaItemByRef(context.originalSchema, schemaItem['$ref']),
                makeContext({
                    itemName: context.itemName,
                    relationInfo: context.relationInfo,
                    refFrom: refFrom
                        ? (refFrom.push(schemaItem), refFrom)
                        : [schemaItem],
                    arrayFrom: context.arrayFrom
                })
            );
        }

        function handleRefFocSchemaMode(renderBase, schemaItem, context) {
            context.selfInfo = BuildDocInfo.IS_REF;
            context.docRenderer(renderBase, schemaItem, context);
        }

        function handleArray(renderBase, schemaItem, context) {
            context.selfInfo = BuildDocInfo.IS_ARRAY;
            var subRenderBase = context.docRenderer(renderBase, schemaItem, context);
            var arrayFrom = context.arrayFrom;

            buildRecursively(
                subRenderBase,
                schemaItem.items,
                makeContext({
                    itemName: context.itemName, // Actually this is array base item name.
                    relationInfo: BuildDocInfo.IS_ARRAY_ITEM,
                    refFrom: null,
                    arrayFrom: arrayFrom
                        ? (arrayFrom.push(schemaItem), arrayFrom)
                        : [schemaItem]
                })
            );
        }

        function handleObject(renderBase, schemaItem, context) {
            context.selfInfo = BuildDocInfo.IS_OBJECT;
            var subRenderBase = context.docRenderer(renderBase, schemaItem, context);

            var properties = schemaItem.properties;
            for (var propertyName in properties) {
                if (properties.hasOwnProperty(propertyName)) {
                    buildRecursively(
                        subRenderBase,
                        properties[propertyName],
                        makeContext({
                            itemName: propertyName,
                            relationInfo: BuildDocInfo.IS_OBJECT_ITEM,
                            refFrom: null,
                            arrayFrom: null
                        })
                    );
                }
            }
        }

        function handlePrimary(renderBase, schemaItem, context) {
            context.selfInfo = BuildDocInfo.IS_PRIMARY;
            context.docRenderer(renderBase, schemaItem, context);
        }
    };

    /**
     * @public
     * @type {Enum}
     */
    var BuildDocInfo = schemaHelper.buildDoc.BuildDocInfo = {
        // relation info
        IS_OBJECT_ITEM: 'isPropertyItem',
        IS_ARRAY_ITEM: 'isArrayItem',
        IS_DEFINITION_ITEM: 'isDefinitionItem',
        // self info
        IS_OBJECT: 'isObject',
        IS_ARRAY: 'isArray',
        IS_PRIMARY: 'isPrimary',
        IS_REF: 'isRef',
        IS_DEFINITION_PARENT: 'isDefinitionParent',
        // oneOf info (only for 'schema' mode)
        IS_ONE_OF_PARENT: 'isOneOfParent',
        IS_ONE_OF_ITEM: 'isOneOfItem',
        // enum info
        IS_ENUM_ITEM: 'isEnumItem',
        IS_ENUM_PARENT: 'isEnumParent'
    };

    /**
     * @public
     */
    schemaHelper.buildDoc.docJsonRenderer = function (renderBase, schemaItem, context) {
        var selfInfo = context.selfInfo;
        var enumInfo = context.enumInfo;
        var children = [];
        var subRenderBase;

        // TODO
        // ref description merge. i.e.
        // { "$ref": ..., descriptionCN: "特殊的描述" }, which should be displayed.

        var prefix = '';
        var suffix = '';
        var childrenBrief = ' ... ';

        if (context.enumInfo !== BuildDocInfo.IS_ENUM_ITEM) {
            var itemName = context.itemName;
            if (itemName) {
                prefix = itemName + ': ';
            }
            var arrayFrom = context.arrayFrom;
            if (arrayFrom) {
                var tmpArr = new Array(arrayFrom.length + 1);
                prefix += tmpArr.join('[');
                suffix += tmpArr.join(']');
            }
        }
        else {
            childrenBrief = ' type: \'' + context.applicable.list()[0] + '\', ... ';
        }

        if (selfInfo === BuildDocInfo.IS_OBJECT) {
            subRenderBase = makeSubRenderBase(schemaItem, context, {
                childrenPre: prefix + '{',
                childrenPost: '}' + suffix + ',',
                childrenBrief: childrenBrief
            });
            children.push(subRenderBase);
        }
        else if (selfInfo === BuildDocInfo.IS_ARRAY) {
            subRenderBase = renderBase;
        }
        else if (selfInfo === BuildDocInfo.IS_PRIMARY) {
            subRenderBase = makeSubRenderBase(schemaItem, context, {
                text: prefix + schemaHelper.getDefaultValueBrief(schemaItem, context) + ','
            });
            children.push(subRenderBase);
        }
        else if (enumInfo === BuildDocInfo.IS_ENUM_PARENT) { // selfInfo == undefined
            subRenderBase = makeSubRenderBase(schemaItem, context, {
                childrenPre: prefix,
                childrenPost: suffix + ',',
                childrenBrief: childrenBrief
            });
            children.push(subRenderBase);
        }

        if (children.length) {
            renderBase.children = (renderBase.children || []).concat(children);
        }

        return subRenderBase;

        function makeSubRenderBase(schemaItem, context, props) {
            var sub = {
                value: 'ecapidocid-' + dtLib.localUID(),
                isEnumParent: context.enumInfo === BuildDocInfo.IS_ENUM_PARENT,
                applicable: new dtLib.Set(context.applicable),
                type: schemaItem.type,
                descriptionCN: schemaItem.descriptionCN,
                descriptionEN: schemaItem.descriptionEN,
                defaultValue: schemaItem['default'],
                defaultExplanation: schemaItem.defaultExplanation,
                tooltipEncodeHTML: false
            };

            if (context.relationInfo === BuildDocInfo.IS_ARRAY_ITEM) {
                sub.arrayName = context.itemName + (new Array(context.arrayFrom.length + 1)).join('[i]');
            }
            else { // IS_OBJECT_ITEM
                sub.propertyName = context.itemName; // For query.
            }

            return $.extend(sub, props);
        }
    };

    /**
     * @public
     */
    schemaHelper.buildDoc.schemaJsonRenderer = function (renderBase, schemaItem, context) {
        var subRenderBase = {
            value: 'ecschemadocid-' + dtLib.localUID(),
            itemName: context.itemName, // for query
            descriptionCN: schemaItem.descriptionCN,
            descriptionEN: schemaItem.descriptionEN,
            type: schemaItem.type,
            ref: schemaItem['$ref'],
            applicable: new dtLib.Set(schemaItem.applicable),
            defaultValue: schemaItem['default'],
            enumerateBy: schemaItem.enumerateBy,
            setApplicable: schemaItem.setApplicable,
            defaultExplanation: schemaItem.defaultExplanation,
            tooltipEncodeHTML: false
        };

        var mapping = {
            'object': '{...}',
            'array': '[...]',
            'regexp': '/.../',
            'function': 'function () {...}',
            '?': ''
        };
        var defualtValue = schemaHelper.getDefaultValueBrief(schemaItem, context, mapping);
        defualtValue = defualtValue ? (': ' + defualtValue) : '';

        var applicable = subRenderBase.applicable.list();
        applicable = applicable.length
            ? ' (applicable: ' + subRenderBase.applicable.list().join(', ') + ')'
            : '';
        var ref = subRenderBase.ref ? ' (ref: ' + subRenderBase.ref + ')' : '' ;

        if (context.oneOfInfo === BuildDocInfo.IS_ONE_OF_ITEM) {
            subRenderBase.text = '[oneOf] ' + context.itemName + defualtValue + applicable + ref;
        }
        else if (context.relationInfo === BuildDocInfo.IS_ARRAY_ITEM) {
            subRenderBase.text = '[ArrayItem] ' + context.itemName + defualtValue + applicable + ref;
        }
        else if (context.selfInfo === BuildDocInfo.IS_PRIMARY) {
            subRenderBase.text = context.itemName + defualtValue + applicable + ref;
        }
        else {
            subRenderBase.text = context.itemName + defualtValue + applicable + ref;
        }

        if (context.relationInfo === BuildDocInfo.IS_OBJECT_ITEM) {
            subRenderBase.propertyName = context.itemName;
        }

        (renderBase.children = (renderBase.children || [])).push(subRenderBase);

        return subRenderBase;
    };

    /**
     * Validate schame by all validators.
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
                        dtLib.assert(schemaHelper.isValidEcOptionType(o.type[i]));
                    }
                }
                else if (typeOfType === 'string') {
                    dtLib.assert(schemaHelper.isValidEcOptionType(o.type));
                }
                else if (typeof o.type !== 'undefined') {
                    dtLib.assert(false);
                }
            });
        },

        // 检查是不是都有en了
        validateLang: function (schema) {
            schemaHelper.travelSchema(schema, function (o) {
                dtLib.assert(
                    (o.descriptionCN && o.descriptionEN) || (!o.descriptionCN && !o.descriptionEN)
                );
            });
        },

        validatorItem: function (schema) {
            schemaHelper.travelSchema(schema, function (o) {
                dtLib.assert(
                    o.hasOwnProperty('$ref') || o.hasOwnProperty('oneOf') || o.hasOwnProperty('type')
                );
                if (o.hasOwnProperty('$ref')) {
                    // 检查是否所有ref都是正确的
                    dtLib.assert($.isPlainObject(schemaHelper.findSchemaItemByRef(schema, o['$ref'])));
                }
                // 检查如果出现oneOf，那么那个obj中不能有别的属性（除非enumerateBy)
                if (o.hasOwnProperty('oneOf')) {
                    dtLib.assert($.isArray(o.oneOf));
                    dtLib.assert(o.oneOf.length);
                    dtLib.assert(dtLib.onlyHasProperty(o, ['oneOf', 'enumerateBy']));
                    // oneOf时没有applicable的项（表示default）只能有一个
                    var oneOf = o.oneOf;
                    var defaultOnes = [];
                    for (var i = 0, len = oneOf.length; i < len; i++) {
                        if (oneOf[i].applicable == null) {
                            defaultOnes.push(oneOf[i]);
                        }
                    }
                    dtLib.assert(defaultOnes.length <= 1);
                }
                if (o.hasOwnProperty('enumerateBy')) {
                    dtLib.assert($.isArray(o.enumerateBy));
                    dtLib.assert(o.enumerateBy.length);
                }

                // if (o.hasOwnProperty('$ref')) {
                    // "参见" should be deleted.
                    // dtLib.assert(o.descriptionCN.indexOf('参见'));
                // }
            });
        }
    };

    /**
     * Travel schema, depth first, preorder.
     *
     * @public
     * @param {Object} o schema item
     * @param {Function} callback The only arg is the schema item being visited.
     * @param {Object} info
     * @param {*=} [info.parentCallbackResult]
     * @param {string=} [info.propertyName]
     * @param {boolean=} [info.isOneOfItem]
     * @param {boolean=} [info.isArrayItem]
     */
    schemaHelper.travelSchema = function (o, callback, info) {
        var callbackResult = callback(o, info);

        if (o.definitions) {
            travelObj(o.definitions, callbackResult, info, true);
        }
        if (o.properties) {
            travelObj(o.properties, callbackResult, info);
        }
        if (o.items) {
            var newInfo = {
                isArrayItem: true,
                parentCallbackResult: callbackResult
            };
            schemaHelper.travelSchema(o.items, callback, newInfo);
        }
        if (o.oneOf) {
            travelOneOf(o.oneOf, callbackResult, info);
        }

        function travelOneOf(arr, callbackResult, info) {
            for (var i = 0; i < arr.length; i++) {
                var newInfo = {
                    propertyName: info.propertyName,
                    isOneOfItem: true,
                    parentCallbackResult: callbackResult
                };
                schemaHelper.travelSchema(arr[i], callback, newInfo);
            }
        }
        function travelObj(obj, callbackResult, info) {
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    var newInfo = {
                        propertyName: key,
                        parentCallbackResult: callbackResult
                    };
                    schemaHelper.travelSchema(obj[key], callback, newInfo);
                }
            }
        }
    };

    /**
     * 是否合法的type
     */
    schemaHelper.isValidEcOptionType = function (type) {
        return dtLib.arrayIndexOf(schemaHelper.EC_OPTION_TYPE, type) !== -1;
    };

    /**
     * @return {Array}
     */
    schemaHelper.getEcOptionTypes = function () {
        return dtLib.clone(schemaHelper.EC_OPTION_TYPE);
    };

    /**
     * 得到默认值的简写，在一行之内显示
     *
     * @public
     * @return {strting}
     */
    schemaHelper.getDefaultValueBrief = function (schemaItem, context, mapping) {
        mapping = $.extend(
            {
                'object': '{ ... }',
                'array': '[ ... ]',
                'regexp': '/.../',
                'function': 'function () { ... }',
                '?': ' ... '
            },
            mapping
        );

        if (schemaItem.hasOwnProperty('default')) {
            var defaultValue = schemaItem['default'];
            var type = $.type(defaultValue);
            if ('null,undefined,number,boolean'.indexOf(type) >= 0) {
                return defaultValue + '';
            }
            else if (type === 'string') {
                return '\'' + defaultValue + '\'';
            }
            else if (mapping[type]) {
                return mapping[type];
            }
        }
        else if (schemaItem.hasOwnProperty('defaultExplanation')) {
            return '<' + schemaItem.defaultExplanation + '>';
        }
        return mapping['?'];
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
            dtLib.assert(ref.indexOf('#') === 0);
            ref = ref.replace('#', '');
            var refArr = ref.split('/');
            dtLib.assert(refArr.length);
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
                str = preStr + dtLib.printFunction(obj, depth, CODE_INDENT_BASE); // FIXME
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