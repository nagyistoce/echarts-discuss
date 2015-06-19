/**
 * 此文件只是从老doc提取schema的工具。用完即作废。所以代码混乱且有很多复制粘贴。
 * 之所以用js写，是为了能发现错误时重新生成。
 */
define(function (require) {

    var $ = require('jquery');
    var schemaHelper = require('../common/schemaHelper');
    var dtUtil = require('dt/util');
    var docUtil = require('../common/docUtil');
    var Set = require('../common/Set');

    var docMainCN = $($('#doc-ifr-cn')[0].contentWindow.document.body);
    var docMainEN = $($('#doc-ifr-en')[0].contentWindow.document.body);
    var DF = 'default';


    function init() {
        $('#lang-btn').on('click', switchLang);
        $('#gen-btn').on('click', generateSchema);
        $('#schema-btn').on('click', toggleSchema);
    }

    function switchLang() {
        $('#doc-ifr-cn').toggle();
        $('#doc-ifr-en').toggle();
    }
去掉markpoint中的geocoord。
    function generateSchema() {
        var originData = originParse();

        var schema = enhance(originData);

        // output
        var str = JSON.stringify(schema, null, 4);
        $('#schema-content')[0].innerHTML = str;
    }

    function originParse() {
        var originData = {};

        originData.option = parseTable('Option');
        originData.timeline = parseTable('Timeline');
        originData.title = parseTable('Title');
        originData.toolbox = parseTable('Toolbox');
        originData.tooltip = parseTable('Tooltip');
        originData.legend = parseTable('Legend');
        originData.dataRange = parseTable('DataRange');
        originData.dataZoom = parseTable('DataZoom');
        originData.roamController = parseTable('RoamController');
        originData.grid = parseTable('Grid');
        originData.axisItem = parseTable('Axis');
        originData.axisAxisLine = parseTable('AxisAxisline');
        originData.axisAxisTick = parseTable('AxisAxistick');
        originData.axisAxisLabel = parseTable('AxisAxislabel');
        originData.axisSplitLine = parseTable('AxisSplitline');
        originData.axisSplitArea = parseTable('AxisSplitarea');
        originData.polar = parseTable('Polar');
        originData.seriesItem = parseTable('Series');
        originData.seriesCartesian = parseTable('SeriesCartesian');
        originData.seriesPie = parseTable('SeriesPie');
        originData.seriesRadar = parseTable('SeriesRadar');
        originData.seriesMap = parseTable('SeriesMap');
        originData.seriesForce = parseTable('SeriesForce');
        originData.seriesChord = parseTable('SeriesChord');
        originData.seriesGauge = parseTable('SeriesGauge');
        originData.seriesFunnel = parseTable('SeriesFunnel');
        originData.seriesEventRiver = parseTable('SeriesEventRiver');
        originData.seriesTreemap = parseTable('SeriesTreemap');
        originData.seriesTree = parseTable('SeriesTree');
        originData.seriesVenn = parseTable('SeriesVenn');
        originData.seriesWordCloud = parseTable('SeriesWordCloud');
        originData.markPoint = parseTable('SeriesMarkPoint');
        originData.markLine = parseTable('SeriesMarkLine');
        originData.itemStyleItem = parseTable('ItemStyle');
        originData.itemStyleLabel = parseTable('ItemStyleLabel');
        originData.itemStyleLabelLine = parseTable('ItemStyleLabelline');
        originData.lineStyle = parseTable('LineStyle');
        originData.areaStyle = parseTable('AreaStyle');
        originData.chordStyle = parseTable('ChordStyle');
        originData.nodeStyle = parseTable('NodeStyle');
        originData.linkStyle = parseTable('LinkStyle');
        originData.textStyle = parseTable('TextStyle');
        originData.loadingOption = parseTable('Loadingoption');
        originData.noDataLoadingOption = parseTable('NoDataLoadingOption');
        originData.dataCategories = parseTable('categories');
        originData.dataNodeData = parseTable('nodes(data)');
        originData.dataGraphLinks = parseTable('GraphLinks');

        return originData;
    }

    function toggleSchema() {
        $('#schema-content').toggle();
    }

    function goNext(anchor, times) {
        for (var i = 0; i < times; i++) {
            anchor = anchor.next();
        }
        return anchor;
    }

    function parseTable(tableName) {
        var tableCN = findTable(tableName, docMainCN);
        var tableEN = findTable(tableName, docMainEN);
        return parseTableByLang(tableName, tableCN, tableEN);
    }

    function parseTableByLang(tableName, tableCN, tableEN) {
        var retCN = {};
        var retEN = {};

        // parse
        $(tableCN.children()[0]).children().each($.proxy(parseLine, null, retCN));
        $(tableEN.children()[0]).children().each($.proxy(parseLine, null, retEN));

        // merge cn and en
        return mergeLang(retCN, retEN);

        function mergeLang(retCN, retEN) {
            for (var name in retCN) {
                if (retCN.hasOwnProperty(name)) {
                    var cnItem = retCN[name];
                    cnItem.descriptionCN = cnItem.description;
                    delete cnItem.description;
                    cnItem.descriptionEN = retEN[name === 'nodes(data)' ? 'nodes' : name].description;
                }
            }
            return retCN;
        }

        function parseLine(ret, index, tr) {
            if (index === 0) {
                return; // 表头：名称、描述
            }
            tr = $(tr);

            var tds = tr.children();
            var tdName;
            var tdDefau;
            var tdDesc;
            var tdApplicable;

            if (tableName === 'Option') { // 只有两列：名称、描述
                tdName = $(tds[0]);
                tdDefau = null;
                tdDesc = $(tds[1]);
            }
            else if (docUtil.contains(
                    [
                        'Axis', 'AxisAxisline', 'AxisAxistick',
                        'AxisAxislabel', 'AxisSplitline', 'AxisSplitArea',
                        'SeriesItem', 'SeriesCartesian',
                        'ItemStyle'
                    ],
                    tableName
                )
            ) { // 有四列：名称、默认值、适用类型、描述
                tdName = $(tds[0]);
                tdDefau = $(tds[1]);
                tdApplicable = $(tds[2]);
                tdDesc = $(tds[3]);
            }
            else { // 有三列：名称、默认值、描述
                tdName = $(tds[0]);
                tdDefau = $(tds[1]);
                tdDesc = $(tds[2]);
            }

            var txt;
            txt = tdName.text();
            var txtArr = /\{(.+)\}(.+)/.exec(txt);

            if (!txtArr) {
                if (txt.indexOf('boolean') >= 0) { // 笔误
                    txtArr = [];
                    txtArr[2] = $.trim(txt.replace('boolean', ''));
                    txtArr[1] = 'boolean';
                }
                else if ($.trim(txt) === 'itemStyle') {
                    txtArr = [];
                    txtArr[2] = 'itemStyle';
                    txtArr[1] = 'Object';
                }
                else {
                    dtUtil.assert(false);
                }
            }
            var o = {};

            var name = $.trim(txtArr[2]);
            o.type = parseType(txtArr[1]);
            o.description = $.trim(tdDesc[0].innerHTML);

            if (tdDefau) {
                // 有些default value区域直接用代码描述的，如timeline.label {Object}。
                // 为了避免转义，直接都用defaultValueHTML字段而非json-schema的default字段。
                o.defaultValueHTML = $.trim(tdDefau[0].innerHTML);
            }

            if (tdApplicable) {
                o.applicable = parseApplicable(tdApplicable[0].innerHTML);
            }
            // 很多series的表，没有单独标注“适用类型”，直接赋值applicable
            else {
                setApplicable(o);
            }

            ret[name] = o;
        }

        function parseType(typeStr) {
            var ecOptionTypes = schemaHelper.getEcOptionTypes();
            typeStr = $.trim(typeStr).toLowerCase();
            var arr = typeStr.split('|');
            var resultArr = [];

            for (var j = 0, lj = arr.length; j < lj; j++) {
                var atype = $.trim(arr[j]).toLowerCase();
                var typeGot = false;
                for (var i = 0, len = ecOptionTypes.length; i < len; i++) {
                    var stype = ecOptionTypes[i];
                    if (atype.indexOf(stype.toLowerCase()) !== -1) {
                        resultArr.push(stype);
                        typeGot = true;
                        break;
                    }
                }
                dtUtil.assert(typeGot);
            }

            dtUtil.assert(resultArr.length);
            if (resultArr.length === 1) {
                return resultArr[0];
            }
            else {
                return resultArr;
            }
        }

        // 设置“使用类型”
        function setApplicable(o) {
            var names = {
                'SeriesPie': 'pie',
                'SeriesRadar': 'radar',
                'SeriesMap': 'map',
                'SeriesForce': 'force',
                'SeriesChord': 'chord',
                'SeriesGauge': 'gauge',
                'SeriesFunnel': 'funnel',
                'SeriesEventRiver': 'eventRiver',
                'SeriesTreemap': 'treemap',
                'SeriesTree': 'tree',
                'SeriesVenn': 'venn',
                'SeriesWordCloud': 'wordCloud'
            };
            if (names[tableName]) {
                o.applicable = names[tableName];
            }
        }

        // 适用类型的解析
        function parseApplicable(str) {
            var axisMapping = {
                '通用': 'all',
                '数值型': 'value',
                '时间型': 'time',
                '类目型': 'category',
                'value': 'value',
                'category': 'category',
                'time': 'time',
                'log': 'log'
            };
            var seriesMapping = {
                '通用': 'all',
                '折': 'line',
                '柱': 'bar',
                '散点': 'scatter',
                'k线': 'k',
                '饼': 'pie',
                '雷达': 'radar',
                '和弦': 'chord',
                '力导': 'force',
                '地图': 'map',
                // 下面这些，原始文档中根本没有在“适用类型”字段中出现过
                // '仪表': 'gauge',
                // '漏斗': 'funnel',
                // '河流': 'eventRiver',
                // '韦恩': 'venn',
                // '矩形树': 'treemap',
                // '树': 'tree',
                // '词云': 'wordCloud'
                'markLine': 'markLine',  // for item style
                'markPoint': 'markPoint' // for item style
            };

            str = $.trim(str);
            var ret = {};

            for (var name in axisMapping) {
                if (axisMapping.hasOwnProperty(name)) {
                    if (str.indexOf(name) !== -1) {
                        ret[axisMapping[name]] = 1;
                    }
                }
            }
            for (var name in seriesMapping) {
                if (seriesMapping.hasOwnProperty(name)) {
                    if (str.indexOf(name) !== -1) {
                        ret[seriesMapping[name]] = 1;
                    }
                }
            }

            var rret = [];
            for (var name in ret) {
                if (ret.hasOwnProperty(name)) {
                    rret.push(name);
                }
            }

            return rret;
        }

    }

    function findTable(name, docMain) {
        // 找到name后的第一个table
        // name: 'Option'
        if (name === 'Axis') {
            return $(docMain.find('a[name=' + name + ']')[0]).parent().next().next().next().next();
        }
        else if (name === 'ItemStyle') {
            return $(docMain.find('a[name=' + name + ']')[0]).parent().next().next().next().next();
        }
        else if (name === 'ItemStyleLabel') {
            return $(docMain.find('a[name=' + 'ItemStyle' + ']')[0]).parent()
            .next().next().next().next().next().next();
        }
        else if (name === 'ItemStyleLabelline') {
            return $(docMain.find('a[name=' + 'ItemStyle' + ']')[0]).parent()
                .next().next().next().next().next().next().next().next();
        }
        else if (name === 'categories' || name === 'GraphLinks') {
            return $(docMain.find('a[name=' + name + ']')[0]).parent().next();
        }
        else if (name === 'nodes(data)') {
            var ret;
            docMain.find('a').each(function (index, el) {
                if ($(el).attr('name') === 'nodes(data)') {
                    ret = $(el).parent().next();
                }
            });
            dtUtil.assert(ret && ret.length);
            return ret;
        }
        else {
            return $(docMain.find('a[name=' + name + ']')[0]).parent().next().next();
        }
    }

    ///////////////////////////////////////////////////////////////////
    // ENHANCE
    ///////////////////////////////////////////////////////////////////

    function enhance(originData) {
        var schema = {
            '$schema': 'http://echarts.baidu.com/doc/json-schema#',
            'definitions': {}, // 所有的真正定义都放在definitions中
            '$ref': '#definitions/option', // option定义
            'type': 'Object'
        };

        for (var name in originData) {
            if (originData.hasOwnProperty(name)) {
                schema.definitions[name] = {
                    type: 'Object',
                    properties: dtUtil.clone(originData[name])
                };
            }
        }

        completeOption(schema);
        completeTimeline(schema);
        completeTitle(schema);
        completeToolbox(schema);
        completeTooltip(schema);
        completeLegend(schema);
        completeDataRange(schema);
        completeAxis(schema);
        completePolor(schema);
        completeSeriesBase(schema);
        completeSeriesData(schema);
        completeSeriesOthers(schema);
        completeMarkPoint(schema);
        completeMarkLine(schema);
        completeItemStyle(schema);
        completeOthers(schema);
        setDefault(schema);

        schemaHelper.validateSchema(schema);

        return schema;
    }

    function setDefault(schema) {
        schemaHelper.travelSchema(schema, function (o) {

            // 顺便去掉applicable中的all
            if (o.applicable === 'all') {
                delete o.applicable;
            }
            else if ($.isArray(o.applicable)) {
                var indexOfAll = dtUtil.arrayIndexOf(o.applicable, 'all');
                if (indexOfAll >= 0) {
                    if (o.applicable.length === 1) {
                        delete o.applicable;
                    }
                    else {
                        dtUtil.assert(false);
                    }
                }
            }

            if (o.defaultValueHTML == null) {
                return;
            }
            dtUtil.assert(o.type);
            var type = new Set(o.type);
            var defaultValueHTML = $.trim(o.defaultValueHTML);
            delete o.defaultValueHTML;

            if (defaultValueHTML === 'null') {
                o[DF] = null;
            }
            else if (defaultValueHTML === 'undefined') {
                o[DF] = undefined;
            }
            else if ($.isNumeric(defaultValueHTML)) {
                if (type.contains('number')) {
                    o[DF] = Number(defaultValueHTML);
                    if (type.count() > 1) {
                        console.log('CHECK: ' + type.list() + ': ' + defaultValueHTML);
                    }
                }
                else {
                    dtUtil.assert(false);
                }
            }
            else if (defaultValueHTML === 'true' || defaultValueHTML === 'false') {
                dtUtil.assert(type.contains('boolean'));
                o[DF] = defaultValueHTML === 'true' ? true : false;
            }
            else if (defaultValueHTML.indexOf('<pre>') === 0) {
                dtUtil.assert(type.contains('Object') || type.contains('Array'));
                dtUtil.assert(defaultValueHTML.indexOf('</pre>') === defaultValueHTML.length - '</pre>'.length);
                var str = defaultValueHTML.replace('<pre>', '').replace('</pre>', '');
                o[DF] = docUtil.parseToObject(str);
            }
            else if (defaultValueHTML.indexOf('{') === 0 && defaultValueHTML !== '{...}') {
                dtUtil.assert(type.contains('Object'));
                dtUtil.assert(defaultValueHTML.indexOf('}') === defaultValueHTML.length - 1);
                o[DF] = docUtil.parseToObject(defaultValueHTML);
            }
            else if (defaultValueHTML.indexOf('[') === 0) {
                dtUtil.assert(type.contains('Array'));
                dtUtil.assert(defaultValueHTML.indexOf(']') === defaultValueHTML.length - 1);
                o[DF] = docUtil.parseToObject(defaultValueHTML);
            }
            else if (
                (type.contains('string') || type.contains('color'))
                && defaultValueHTML.indexOf('各异') === -1
                && defaultValueHTML.indexOf('\'|\'') === -1
                && defaultValueHTML.indexOf('\' | \'') === -1
                && (
                    countQuote(defaultValueHTML) === 2
                    || countDoubleQuote(defaultValueHTML) === 2
                    || countQuote(defaultValueHTML) === 0
                    || countDoubleQuote(defaultValueHTML) === 0
                )
            ) {
                var value = $.trim(defaultValueHTML);
                if (value.charAt(0) === '\'' && value.charAt(value.length - 1) === '\'') {
                    value = value.replace(/'/g, '');
                }
                if (value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
                    value = value.replace(/"/g, '');
                }
                o[DF] = value;
            }
            else {
                o.defaultExplanation = defaultValueHTML;
            }
        });
    }

    function countQuote(str) {
        var count = 0;
        str.replace(/'/g, function () {
            count++;
        });
        return count;
    }

    function countDoubleQuote(str) {
        var count = 0;
        str.replace(/"/g, function () {
            count++;
        });
        return count;
    }

    function addRef(obj, refStr) {
        setProp(obj, '$ref', refStr);
    }

    function setProp(obj, propName, value) {
        if (obj.oneOf) {
            for (var i = 0; i < obj.oneOf.length; i++) {
                obj.oneOf[i][propName] = value;
            }
        }
        else {
            obj[propName] = value;
        }
    }

    function completeOption(schema) {
        var optionProperties = schema.definitions.option.properties;

        addRef(optionProperties.timeline, '#definitions/timeline');
        addRef(optionProperties.title, '#definitions/title');
        addRef(optionProperties.toolbox, '#definitions/toolbox');
        addRef(optionProperties.tooltip, '#definitions/tooltip');
        addRef(optionProperties.legend, '#definitions/legend');
        addRef(optionProperties.dataRange, '#definitions/dataRange');
        addRef(optionProperties.dataZoom, '#definitions/dataZoom');
        addRef(optionProperties.roamController, '#definitions/roamController');
        addRef(optionProperties.grid, '#definitions/grid');
        addRef(optionProperties.xAxis, '#definitions/axis');
        addRef(optionProperties.yAxis, '#definitions/axis');
        addRef(optionProperties.series, '#definitions/series');


        optionProperties.backgroundColor.defaultValueHTML = 'rgba(0,0,0,0)';
        optionProperties.color.defaultValueHTML = schemaHelper.stringifyJSObject2HTML([
            '#ff7f50','#87cefa','#da70d6','#32cd32','#6495ed',
            '#ff69b4','#ba55d3','#cd5c5c','#ffa500','#40e0d0',
            '#1e90ff','#ff6347','#7b68ee','#00fa9a','#ffd700',
            '#6699FF','#ff6666','#3cb371','#b8860b','#30e0e0'
        ]);

        optionProperties.renderAsImage.type = ['boolean', 'string'];
        optionProperties.renderAsImage.defaultValueHTML = 'false';
        optionProperties.renderAsImage.descriptionCN += ''
            + '非IE8-支持渲染为图片，可设为true或指定图片格式（png | jpeg），'
            + '渲染为图片后实例依然可用（如setOption，resize等），但各种交互失效';
        optionProperties.renderAsImage.descriptionEN += ''
            + 'supports render as image in non-IE8- browsers, '
            + 'can be set to true or specify image formats (png | jpeg). '
            + 'After rendered as image, the instance is still available (such as setOption, resize, etc.), '
            + 'but its various interactions will become invalid.';

        optionProperties.symbolList = {};
        optionProperties.symbolList.type = 'Array';
        optionProperties.symbolList.defaultValueHTML = schemaHelper.stringifyJSObject2HTML([
                'circle', 'rectangle', 'triangle', 'diamond', 'emptyCircle',
                'emptyRectangle', 'emptyTriangle', 'emptyDiamond'
        ]);
        optionProperties.symbolList.descriptionCN += '默认标志图形类型列表，循环使用';
        optionProperties.symbolList.descriptionEN += ''
            + 'An array containing the default symbols. '
            + 'When all symbols are used, new symbols are pulled from the start again';

        optionProperties.calculable.defaultValueHTML = 'false';
        optionProperties.calculableColor = {
            type: 'color',
            defaultValueHTML: 'rgba(255,165,0,0.6)',
            descriptionCN: '拖拽重计算提示边框颜色',
            descriptionEN: 'color of border around drag-recalculate'
        };
        optionProperties.calculableHolderColor = {
            type: 'color',
            defaultValueHTML: '#ccc',
            descriptionCN: '可计算占位提示颜色',
            descriptionEN: 'color of calculable holder.'
        };

        optionProperties.nameConnector = {
            type: 'string',
            defaultValueHTML: ' & ',
            descriptionCN: '数据合并名字间连接符',
            descriptionEN: ''
                + 'a connector that links the names of data series'
                + 'together after the combination of data series'
        };
        optionProperties.valueConnector = {
            type: 'string',
            defaultValueHTML: ': ',
            descriptionCN: '数据合并名字与数值间连接符',
            descriptionEN: ''
                + ' a connector that links the name of data series '
                + 'with value when island appears after the combination of data series'
        };

        optionProperties.animation = {
            type: 'boolean',
            defaultValueHTML: 'true',
            descriptionCN: '是否启用图表初始化动画，默认开启，建议IE8-关闭',
            descriptionEN: ''
                + 'specifies whether the initial animation will be enabled, '
                + 'defaults to true. It is suggested to disable the initial animation in IE8-'
        };
        optionProperties.addDataAnimation = {
            type: 'boolean',
            defaultValueHTML: 'true',
            descriptionCN: '是否启用动态数据接口动画效果，默认开启，建议IE8-关闭',
            descriptionEN: ''
                + 'specifies whether the dynamic data interface animation will be enabled, '
                + 'defaults to true. It is suggested to disable animation in IE8-'
        };
        optionProperties.animationThreshold = {
            type: 'number',
            defaultValueHTML: '2000',
            descriptionCN: '动画元素阀值，产生的图形原素超过2000不出动画，默认开启，建议IE8-关闭',
            descriptionEN: ''
                + 'threshold of animated elements. No animation if the graphic elements '
                + 'generated are over 2500. It is suggested to disable animation in IE8-.'
        };
        optionProperties.animationDuration = {
            type: 'number',
            defaultValueHTML: '2000',
            descriptionCN: '进入动画时长，单位ms',
            descriptionEN: 'duration of the enter animation, in ms.'
        };
        optionProperties.animationDurationUpdate = {
            type: 'number',
            defaultValueHTML: '500',
            descriptionCN: '更新动画时长，单位ms',
            descriptionEN: 'duration of the update animation, in ms.'
        };
        optionProperties.animationEasing = {
            type: 'string',
            defaultValueHTML: 'ExponentialOut',
            descriptionCN: ''
                + '主元素的缓动效果，详见<a href="http://ecomfe.github.io/zrender/doc/doc.html#animation.easing"'
                + ' target="_blank">zrender.animation.easing</a>，可选有：<br>'
                + '\'Linear\',<br>'
                + '\'QuadraticIn\', \'QuadraticOut\', \'QuadraticInOut\',<br>'
                + '\'CubicIn\', \'CubicOut\', \'CubicInOut\',<br>'
                + '\'QuarticIn\', \'QuarticOut\', \'QuarticInOut\',<br>'
                + '\'QuinticIn\', \'QuinticOut\', \'QuinticInOut\',<br>'
                + '\'SinusoidalIn\', \'SinusoidalOut\', \'SinusoidalInOut\',<br>'
                + '\'ExponentialIn\', \'ExponentialOut\', \'ExponentialInOut\',<br>'
                + '\'CircularIn\', \'CircularOut\', \'CircularInOut\',<br>'
                + '\'ElasticIn\', \'ElasticOut\', \'ElasticInOut\',<br>'
                + '\'BackIn\', \'BackOut\', \'BackInOut\',<br>'
                + '\'BounceIn\', \'BounceOut\', \'BounceInOut\'<br>'
                + '</p>',
            descriptionEN: ''
                + 'easing effect of the main element. Supports multi-level control. See<a href="http://ecomfe.github.io/zrender/doc/doc.html#animation.easing"'
                + ' target="_blank">zrender.animation.easing</a>, Possible values are: <br>'
                + '\'Linear\',<br>'
                + '\'QuadraticIn\', \'QuadraticOut\', \'QuadraticInOut\',<br>'
                + '\'CubicIn\', \'CubicOut\', \'CubicInOut\',<br>'
                + '\'QuarticIn\', \'QuarticOut\', \'QuarticInOut\',<br>'
                + '\'QuinticIn\', \'QuinticOut\', \'QuinticInOut\',<br>'
                + '\'SinusoidalIn\', \'SinusoidalOut\', \'SinusoidalInOut\',<br>'
                + '\'ExponentialIn\', \'ExponentialOut\', \'ExponentialInOut\',<br>'
                + '\'CircularIn\', \'CircularOut\', \'CircularInOut\',<br>'
                + '\'ElasticIn\', \'ElasticOut\', \'ElasticInOut\',<br>'
                + '\'BackIn\', \'BackOut\', \'BackInOut\',<br>'
                + '\'BounceIn\', \'BounceOut\', \'BounceInOut\'<br>'
                + '</p>'
        };
    }

    function completeTimeline(schema) {
        var timelinePorperties = schema.definitions.timeline.properties;

        addRef(timelinePorperties.lineStyle, '#definitions/lineStyle');
        timelinePorperties.label.properties = {
            show: {
                type: 'boolean',
                defaultValueHTML: 'true',
                descriptionCN: '是否显示时间轴标签文本',
                descriptionEN: 'specifies whether to show'
            },
            interval: {
                type: ['string', 'number'],
                defaultValueHTML: 'auto',
                descriptionCN: '挑选间隔，默认为\'auto\'，可选为：\'auto\'（自动隐藏显示不下的） | 0（全部显示） | {number} ',
                descriptionEN: ''
                    + 'sets interval. Defaults to \'auto\'. Valid values are: \'auto\' '
                    + '(automatically hide those that cannot be displayed) | 0 (unhide all) | {number}'
            },
            rotate: {
                type: 'number',
                defaultValueHTML: '0',
                descriptionCN: '旋转角度，默认为0，不旋转，正值为逆时针，负值为顺时针，可选为：-90 ~ 90',
                descriptionEN: ''
                    + 'the angle of rotation, defaults to 0 (not rotate). Positive value for counterclockwise '
                    + 'rotation, negative value for clockwise rotation. Valid values are: -90 ~ 90 '
            },
            formatter: {
                type: ['string', 'Function'],
                defaultValueHTML: 'null',
                descriptionCN: '间隔名称格式器',
                descriptionEN: 'interval name formatter:'
            },
            textStyle: {
                type: 'Object',
                defaultValueHTML: '{color: \'#333\'}',
                descriptionCN: '文字样式（详见<a href="#TextStyle" title="">textStyle</a>）',
                descriptionEN: 'text style (see <a href="#TextStyle" title="">textStyle</a>)',
                '$ref': '#definitions/textStyle'
            }
        };

        timelinePorperties.checkpointStyle.properties = {
            symbol: {
                type: 'string',
                defaultValueHTML: 'auto',
                descriptionCN: '当前点symbol，默认随轴上的symbol',
                descriptionEN: 'symbol of the checkpoint, defaults to the symbol on timeline.'
            },
            symbolSize: {
                type: ['number', 'string'],
                defaultValueHTML: 'auto',
                descriptionCN: '当前点symbol大小，默认随轴上symbol大小',
                descriptionEN: 'size of the checkpoint symbol, defaults to the size of symbol on timeline. color: color of the checkpoint symbol, defaults to the color of the checkpoint. A specific color can be specified; If unspecified, defaults to \'#1e90ff\''
            },
            color: {
                type: 'color',
                defaultValueHTML: '#1e90ff',
                descriptionCN: '当前点symbol颜色，默认为随当前点颜色',
                descriptionEN: 'color of the checkpoint symbol, defaults to the color of the checkpoint. A specific color can be specified;'
            },
            borderColor: {
                type: 'color',
                defaultValueHTML: 'auto',
                descriptionCN: '当前点symbol边线颜色',
                descriptionEN: 'the color of the checkpoint symbol border'
            },
            borderWidth: {
                type: ['number', 'string'],
                defaultValueHTML: 'auto',
                descriptionCN: '当前点symbol边线宽度',
                descriptionEN: 'the width of the checkpoint symbol border'
            },
            label: {
                type: 'Object',
                '$ref': '#definitions/timeline/properties/label'
            }
        };

        timelinePorperties.controlStyle.properties = {
            itemSize: {
                type: 'number',
                defaultValueHTML: '15',
                descriptionCN: '按钮大小',
                descriptionEN: 'size of button'
            },
            itemGap: {
                type: 'number',
                defaultValueHTML: '5',
                descriptionCN: '按钮间隔',
                descriptionEN: 'gap size of buttons'
            },
            normal: {
                type: 'Object',
                properties: {
                    color: {
                        type: 'color',
                        defaultValueHTML: '#333',
                        descriptionCN: '正常颜色',
                        descriptionEN: 'color in normal state'
                    }
                }
            },
            emphasis: {
                type: 'Object',
                properties: {
                    color: {
                        type: 'color',
                        defaultValueHTML: '#1e90ff',
                        descriptionCN: '高亮颜色',
                        descriptionEN: 'color when highlighted'
                    }
                }
            }
        };
    }

    function completeTitle(schema) {
        var titlePorperties = schema.definitions.title.properties;
        addRef(titlePorperties.textStyle, '#definitions/textStyle');
    }

    function completeToolbox(schema) {
        var properties = schema.definitions.toolbox.properties;
        addRef(properties.textStyle, '#definitions/textStyle');
    }

    function completeTooltip(schema) {
        var properties = schema.definitions.tooltip.properties;
        properties.axisPointer.properties = {
            type: {
                type: 'string',
                defaultValueHTML: 'line',
                descriptionCN: '可选值：\'line\' | \'cross\' | \'shadow\' | \'none\'(无)，指定type后对应style生效（如下）',
                descriptionEN: 'Possible value: \'line\' | \'cross\' | \'shadow\' | \'none\'. Each type has its corresponding style, see below.'
            },
            lineStyle: {
                type: 'Object',
                defaultValueHTML: schemaHelper.stringifyJSObject2HTML({
                    color: '#48b',
                    width: 2,
                    type: 'solid'
                }),
                descriptionCN: '设置直线指示器',
                descriptionEN: 'style for line pointer',
                '$ref': '#definitions/lineStyle'
            },
            crossStyle: {
                type: 'Object',
                defaultValueHTML: schemaHelper.stringifyJSObject2HTML({
                    color: '#1e90ff',
                    width: 1,
                    type: 'dashed'
                }),
                descriptionCN: '设置十字准星指示器',
                descriptionEN: 'style for crosshairs pointer',
                '$ref': '#definitions/lineStyle'
            },
            shadowStyle: {
                type: 'Object',
                defaultValueHTML: schemaHelper.stringifyJSObject2HTML({
                    color: 'rgba(150,150,150,0.3)',
                    width: 'auto',
                    type: 'default',
                    size: 'auto'
                }),
                descriptionCN: '设置阴影指示器',
                descriptionEN: 'style for shadow pointer',
                '$ref': '#definitions/areaStyle'
            },
            textStyle: {
                type: 'Object',
                defaultValueHTML: schemaHelper.stringifyJSObject2HTML({
                    color: '#fff'
                }),
                descriptionCN: '文本样式',
                descriptionEN: 'text style',
                '$ref': '#definitions/textStyle'
            }
        };

        // formatter大段描述信息
        properties.formatter.descriptionCN += '<br>' + $(docMainCN.find('a[name=Tooltip]')[0]).parent()
            .next().next().next().next()[0].innerHTML;
        properties.formatter.descriptionEN += '<br>' + $(docMainEN.find('a[name=Tooltip]')[0]).parent()
            .next().next().next().next()[0].innerHTML;
    }

    function completeLegend(schema) {
        var properties = schema.definitions.legend.properties;
        addRef(properties.textStyle, '#definitions/textStyle');
    }

    function completeDataRange(schema) {
        var properties = schema.definitions.dataRange.properties;
        addRef(properties.textStyle, '#definitions/textStyle');
    }

    function completeAxis(schema) {
        schema.definitions.axis = {
            type: 'Array',
            items: {
                '$ref': '#definitions/axisItem'
            }
        };

        schema.definitions.axisItem.enumerateBy = schemaHelper.EC_AXIS_APPLICABLE.slice();

        var axisProperties = schema.definitions.axisItem.properties;

        // axis.data
        var anchor;
        anchor = $(docMainCN.find('a[name=AxisData]')[0]).parent();
        axisProperties.data.descriptionCN = [
            (anchor = anchor.next())[0].innerHTML,
            (anchor = anchor.next())[0].innerHTML,
            (anchor = anchor.next())[0].innerHTML,
            (anchor = anchor.next())[0].innerHTML
        ].join('');
        anchor = $(docMainEN.find('a[name=AxisData]')[0]).parent();
        axisProperties.data.descriptionEN = [
            (anchor = anchor.next())[0].innerHTML,
            (anchor = anchor.next())[0].innerHTML,
            (anchor = anchor.next())[0].innerHTML,
            (anchor = anchor.next())[0].innerHTML
        ].join('');

        // axis ref
        addRef(axisProperties.axisLine, '#definitions/axisAxisLine');
        addRef(axisProperties.axisTick, '#definitions/axisAxisTick');
        addRef(axisProperties.axisLabel, '#definitions/axisAxisLabel');
        addRef(axisProperties.splitLine, '#definitions/axisSplitLine');
        addRef(axisProperties.splitArea, '#definitions/axisSplitArea');

        // axis others
        var properties;

        properties = schema.definitions.axisAxisLine.properties;
        addRef(properties.lineStyle, '#definitions/lineStyle');

        properties = schema.definitions.axisAxisTick.properties;
        addRef(properties.lineStyle, '#definitions/lineStyle');

        properties = schema.definitions.axisAxisLabel.properties;
        addRef(properties.textStyle, '#definitions/textStyle');

        properties = schema.definitions.axisSplitLine.properties;
        addRef(properties.lineStyle, '#definitions/lineStyle');

        properties = schema.definitions.axisSplitArea.properties;
        addRef(properties.areaStyle, '#definitions/areaStyle');

        // defaultByApplicable
        var one = axisProperties.type;
        var defaultValueHTML = one.defaultValueHTML;
        var defaultByApplicable = one.defaultByApplicable = {};

        for (var j = 0; j < schemaHelper.EC_AXIS_APPLICABLE.length; j++) {
            var app = schemaHelper.EC_AXIS_APPLICABLE[j];
            if (defaultValueHTML.indexOf(app) >= 0) {
                defaultByApplicable[app] = app;
            }
        }
    }

    function completePolor(schema) {
        var properties = schema.definitions.polar.properties;
        addRef(properties.axisLine, '#definitions/axisAxisLine');
        addRef(properties.axisLabel, '#definitions/axisAxisLabel');
        addRef(properties.splitLine, '#definitions/axisSplitLine');
        addRef(properties.splitArea, '#definitions/axisSplitArea');

        properties.indicator.descriptionCN += '<br>' + schemaHelper.stringifyJSObject2HTML([
            {text: '外观'},
            {text: '拍照', min: 0},
            {text: '系统', min: 0, max: 100},
            {text: '性能', axisLabel: {}},
            {text: '屏幕'}
        ]);
        properties.indicator.descriptionCN += '<br>' + schemaHelper.stringifyJSObject2HTML([
            {text: 'outlook'},
            {text: 'photo', min: 0},
            {text: 'system', min: 0, max: 100},
            {text: 'performance', axisLabel: {}},
            {text: 'screen'}
        ]);
    }

    function completeSeriesBase(schema) {
        schema.definitions.series = {
            type: 'Array',
            items: {
                '$ref': '#definitions/seriesItem'
            }
        };
    }

    function completeSeriesOthers(schema) {
        var seriesProperties = schema.definitions.seriesItem.properties;

        schema.definitions.seriesItem.enumerateBy = schemaHelper.EC_SERIES_APPLICABLE.slice();

        addRef(seriesProperties.itemStyle, '#definitions/itemStyle');
        addRef(seriesProperties.markPoint, '#definitions/markPoint');
        addRef(seriesProperties.markLine, '#definitions/markLine');

        // merge
        var sers = [
            'seriesCartesian', 'seriesPie', 'seriesRadar', 'seriesMap',
            'seriesForce', 'seriesChord', 'seriesGauge', 'seriesFunnel',
            'seriesEventRiver', 'seriesTreemap', 'seriesTree', 'seriesVenn', 'seriesWordCloud'
        ];
        for (var i = 0; i < sers.length; i++) {
            var properties = schema.definitions[sers[i]].properties;
            for (var name in properties) {
                if (properties.hasOwnProperty(name)) {
                    if (name === 'data') {
                        continue;
                    }
                    if (seriesProperties[name]) { // 不同表格中重复定义的情况
                        // console.log('series property repeat in tables: ' + name);
                        if (!seriesProperties[name].oneOf) {
                            var origin = seriesProperties[name];
                            seriesProperties[name] = {oneOf: [origin]};
                        }
                        seriesProperties[name].oneOf.push(properties[name]);
                    }
                    else {
                        seriesProperties[name] = properties[name];
                    }
                }
            }
            delete schema.definitions[sers[i]];
        }

        // var symbols = schemaHelper.querySchema(schema, 'series[i](applicable=radar,force,chord)');
        // radar
        seriesProperties.symbol.oneOf[0].applicable.push('radar', 'force', 'chord', 'tree');
        seriesProperties.symbolSize.oneOf[0].applicable.push('radar');
        seriesProperties.symbolRotate.oneOf[0].applicable.push('radar');
        seriesProperties.symbol.oneOf = [seriesProperties.symbol.oneOf[0]];
        dtUtil.assert(seriesProperties.symbolSize.oneOf[1].applicable === 'radar');
        dtUtil.assert(seriesProperties.symbolRotate.oneOf[1].applicable === 'radar');
        seriesProperties.symbolSize.oneOf.splice(1, 1);
        seriesProperties.symbolRotate.oneOf.splice(1, 1);


        // chord and force
        addRef(seriesProperties.categories, '#definitions/dataCategories');
        addRef(seriesProperties.links, '#definitions/dataGraphLinks');
        setProp(seriesProperties.matrix, 'descriptionCN', '邻接矩阵, 和links二选一。关系数据，用二维数组表示，项 [i][j] 的数值表示 i 到 j 的关系数据');
        setProp(seriesProperties.matrix, 'descriptionEN', 'Adjacency matrix. Only one of links and matrix can exist. Matrix is a two-dimensional array, where [i][j] means data relationship from i to j');

        seriesProperties.nodes = {
            type: 'Array',
            items: {
                '$ref': '#definitions/dataNodeData'
            },
            applicable: ['chord', 'force']
        };
        var originalNodes = seriesProperties['nodes(data)'];
        delete seriesProperties['nodes(data)'];
        makeForceNodeData(originalNodes);

        function makeForceNodeData(originalNodes) {
            var nodeDescCN = originalNodes.oneOf[0].descriptionCN;
            var nodeDescEN = originalNodes.oneOf[0].descriptionEN;
            var el = document.createElement('div');
            el.innerHTML = nodeDescCN;
            var tableCN = $(el).find('table');
            el.innerHTML = nodeDescEN;
            var tableEN = $(el).find('table');
            var tableInfo = parseTableByLang('forceNodeData', tableCN, tableEN);

            var nodeDataProp = schema.definitions.dataNodeData.properties;

            for (var i = 0; i < tableInfo.length; i++) {
                var line = tableInfo[i];
                line.applicable = 'force';
                nodeDataProp.push(line);
            }
        }

        // defaultByApplicable
        var one = seriesProperties.type;
        var defaultByApplicable = one.defaultByApplicable = {};

        for (var j = 0; j < schemaHelper.EC_SERIES_APPLICABLE.length; j++) {
            var app = schemaHelper.EC_SERIES_APPLICABLE[j];
            defaultByApplicable[app] = app;
        }
    }

    function completeSeriesData(schema) {
        var seriesProperties = schema.definitions.seriesItem.properties;

        var originData = seriesProperties.data;
        seriesProperties.data = {oneOf: []};

        var descCN = findDesc(docMainCN);
        var descEN = findDesc(docMainEN);
        var data;

        data = dtUtil.clone(originData);
        seriesProperties.data.oneOf.push(data);
        data.applicable = 'all';
        data.descriptionCN = descCN.allDesc;
        data.descriptionEN = descEN.allDesc;

        data = dtUtil.clone(originData);
        seriesProperties.data.oneOf.push(data);
        data.applicable = ['line', 'bar'];
        data.descriptionCN = descCN.cartesianDesc;
        data.descriptionEN = descEN.cartesianDesc;

        data = dtUtil.clone(originData);
        seriesProperties.data.oneOf.push(data);
        data.applicable = 'scatter';
        data.descriptionCN = descCN.scatterDesc;
        data.descriptionEN = descEN.scatterDesc;

        data = dtUtil.clone(originData);
        seriesProperties.data.oneOf.push(data);
        data.applicable = 'k';
        data.descriptionCN = descCN.kDesc;
        data.descriptionEN = descEN.kDesc;

        data = dtUtil.clone(originData);
        seriesProperties.data.oneOf.push(data);
        data.applicable = 'pie';
        data.descriptionCN = descCN.pieDesc;
        data.descriptionEN = descEN.pieDesc;

        data = dtUtil.clone(originData);
        seriesProperties.data.oneOf.push(data);
        data.applicable = 'map';
        data.descriptionCN = descCN.mapDesc;
        data.descriptionEN = descEN.mapDesc;

        // 事件河流图的data在表格中
        var seriesEventRiverProperties = schema.definitions.seriesEventRiver.properties;
        seriesProperties.data.oneOf.push(seriesEventRiverProperties.data);
        seriesEventRiverProperties.data.applicable = 'eventRiver';

        // treemap图的data在表格中
        var seriesTreemapProperties = schema.definitions.seriesTreemap.properties;
        seriesProperties.data.oneOf.push(seriesTreemapProperties.data);
        seriesTreemapProperties.data.applicable = 'treemap';

        // tree图的data在表格中
        var seriesTreeProperties = schema.definitions.seriesTree.properties;
        seriesProperties.data.oneOf.push(seriesTreeProperties.data);
        seriesTreeProperties.data.applicable = 'tree';

        // venn图的data在表格中
        var seriesVennProperties = schema.definitions.seriesVenn.properties;
        seriesProperties.data.oneOf.push(seriesVennProperties.data);
        seriesVennProperties.data.applicable = 'venn';

        function findDesc(docMain) {
            var anchor = $(docMain.find('a[name=SeriesData]')[0]).parent();

            return {
                allDesc: [
                    goNext(anchor, 3)[0].innerHTML,
                    goNext(anchor, 4)[0].innerHTML
                ].join(''),
                cartesianDesc: [
                    goNext(anchor, 1)[0].innerHTML,
                    goNext(anchor, 2)[0].innerHTML,
                    goNext(anchor, 3)[0].innerHTML,
                    goNext(anchor, 4)[0].innerHTML,
                    goNext(anchor, 5)[0].innerHTML,
                    goNext(anchor, 6)[0].innerHTML
                ].join(''),
                scatterDesc: [
                    goNext(anchor, 3)[0].innerHTML,
                    goNext(anchor, 4)[0].innerHTML,
                    goNext(anchor, 7)[0].innerHTML,
                    goNext(anchor, 8)[0].innerHTML
                ].join(''),
                kDesc: [
                    goNext(anchor, 3)[0].innerHTML,
                    goNext(anchor, 4)[0].innerHTML,
                    goNext(anchor, 9)[0].innerHTML,
                    goNext(anchor, 10)[0].innerHTML
                ].join(''),
                pieDesc: [
                    goNext(anchor, 3)[0].innerHTML,
                    goNext(anchor, 4)[0].innerHTML,
                    goNext(anchor, 11)[0].innerHTML,
                    goNext(anchor, 12)[0].innerHTML
                ].join(''),
                mapDesc: [
                    goNext(anchor, 3)[0].innerHTML,
                    goNext(anchor, 4)[0].innerHTML,
                    goNext(anchor, 13)[0].innerHTML,
                    goNext(anchor, 14)[0].innerHTML
                ].join('')
            };
        }
    }

    function completeMarkPoint(schema) {
        var properties = schema.definitions.markPoint.properties;

        addRef(properties.symbol, '#definitions/seriesItem/properties/symbol');
        addRef(properties.symbolSize, '#definitions/seriesItem/properties/symbolSize');
        addRef(properties.symbolRotate, '#definitions/seriesItem/properties/symbolRotate');
        addRef(properties.itemStyle, '#definitions/itemStyle');
        addRef(properties.geoCoord, '#definitions/seriesItem/properties/geoCoord');

        // effect
        properties.effect.properties = {
            show: {
                type: 'boolean',
                defaultValueHTML: 'false',
                descriptionCN: '是否开启炫光特效，默认关闭',
                descriptionEN: 'specifies whether to show glow effect or not. Defaults to false. '
            },
            type: {
                type: 'string',
                defaultValueHTML: 'scale',
                descriptionCN: '特效类型，默认为\'scale\'（放大），可选还有\'bounce\'（跳动）',
                descriptionEN: 'effect type, default to \'scale\', can be \'bounce\''
            },
            loop: {
                type: 'boolean',
                defaultValueHTML: 'true',
                descriptionCN: '循环动画，默认开启',
                descriptionEN: 'specifies whether to play the animation in a loop. Defaults to true.'
            },
            period: {
                type: 'number',
                defaultValueHTML: '15',
                descriptionCN: '运动周期，无单位，值越大越慢，默认为15 ',
                descriptionEN: 'animation period. No units. The larger the value, the slower. Defaults to 15.'
            },
            scaleSize: {
                type: 'number',
                defaultValueHTML: '2',
                descriptionCN: '放大倍数，以markPoint symbolSize为基准，type为scale时有效。',
                descriptionEN: 'magnification. Based on markPoint symbolSize, available when type is scale.'
            },
            bounceDistance: {
                type: 'number',
                defaultValueHTML: '10',
                descriptionCN: '跳动距离，单位为px，type为bounce时有效',
                descriptionEN: 'bouncing distance, in px, available when type is bounce. '
            },
            color: {
                type: 'color',
                defaultValueHTML: 'null',
                descriptionCN: '炫光颜色，默认跟随markPoint itemStyle定义颜色',
                descriptionEN: 'color of the glow. The default value is pulled from the markPoint itemStyle array. '
            },
            shadowColor: {
                type: 'color',
                defaultValueHTML: 'null',
                descriptionCN: '光影颜色，默认跟随color',
                descriptionEN: 'color of the shadow. The default value is pulled from the color array. '
            },
            shadowBlur: {
                type: 'number',
                defaultValueHTML: '0',
                descriptionCN: '光影模糊度，默认为0',
                descriptionEN: 'blur degree of shadow. Defaults to 0. '
            }
        };

        // markPoint data
        var originData = properties.data;
        var data;
        var descCN = findDesc(docMainCN);
        var descEN = findDesc(docMainEN);
        properties.data = {oneOf: []};

        data = dtUtil.clone(originData);
        properties.data.oneOf.push(data);
        data.applicable = 'all';
        data.descriptionCN = '标注图形数据';
        data.descriptionEN = 'data of markPoint';

        data = dtUtil.clone(originData);
        properties.data.oneOf.push(data);
        data.applicable = ['pie', 'radar', 'force', 'chord'];
        data.descriptionCN = descCN.pieLike;
        data.descriptionEN = descEN.pieLike;

        data = dtUtil.clone(originData);
        properties.data.oneOf.push(data);
        data.applicable = ['line', 'bar', 'k', 'scatter'];
        data.descriptionCN = descCN.lineLike;
        data.descriptionEN = descEN.lineLike;

        data = dtUtil.clone(originData);
        properties.data.oneOf.push(data);
        data.applicable = 'map';
        data.descriptionCN = descCN.mapLike;
        data.descriptionEN = descEN.mapLike;

        function findDesc(docMain) {
            var anchor = $(docMain.find('a[name=SeriesMarkPointData]')[0]).parent();

            return {
                pieLike: [
                    goNext(anchor, 1)[0].innerHTML,
                    goNext(anchor, 2)[0].innerHTML
                ].join(''),
                lineLike: [
                    goNext(anchor, 3)[0].innerHTML,
                    goNext(anchor, 4)[0].innerHTML,
                    goNext(anchor, 5)[0].innerHTML,
                    goNext(anchor, 6)[0].innerHTML
                ].join(''),
                mapLike: [
                    goNext(anchor, 7)[0].innerHTML,
                    goNext(anchor, 8)[0].innerHTML
                ].join('')
            };
        }
    }

    function completeMarkLine(schema) {
        var properties = schema.definitions.markLine.properties;

        addRef(properties.symbol, '#definitions/seriesItem/properties/symbol');
        addRef(properties.symbolSize, '#definitions/seriesItem/properties/symbolSize');
        addRef(properties.symbolRotate, '#definitions/seriesItem/properties/symbolRotate');
        addRef(properties.itemStyle, '#definitions/itemStyle');
        addRef(properties.geoCoord, '#definitions/seriesItem/properties/geoCoord');

        // bundling
        properties.bundling.properties = {
            enable: {
                type: 'boolean',
                defaultValueHTML: 'false',
                descriptionCN: '是否使用边捆绑，默认关闭 ',
                descriptionEN: 'If enable edge bundling.'
            },
            maxTurningAngle: {
                type: 'number',
                defaultValueHTML: '45',
                descriptionCN: '边捆绑算法参数，可选 [0, 90] 的角度，配置捆绑后的边最大拐角, 默认为 45 度。注：捆绑算法使用 Multilevel Agglomerative Edge Bundling for Visualizing Large Graphs',
                descriptionEN: 'maxTurningAngle: Max turning angle of bundled edge, ranges from 0 degree to 90 degree. Tip：Edge bundling use algorithm from "Multilevel Agglomerative Edge Bundling for Visualizing Large Graphs"'
            }
        };

        // effect
        properties.effect.properties = {
            show: {
                type: 'boolean',
                defaultValueHTML: 'false',
                descriptionCN: '是否开启炫光特效，默认关闭',
                descriptionEN: 'specifies whether to show glow effect or not. Defaults to false. '
            },
            loop: {
                type: 'boolean',
                defaultValueHTML: 'true',
                descriptionCN: '循环动画，默认开启',
                descriptionEN: 'specifies whether to play the animation in a loop. Defaults to true.'
            },
            period: {
                type: 'number',
                defaultValueHTML: '15',
                descriptionCN: '运动周期，无单位，值越大越慢，默认为15 ',
                descriptionEN: 'animation period. No units. The larger the value, the slower. Defaults to 15.'
            },
            scaleSize: {
                type: 'number',
                defaultValueHTML: '2',
                descriptionCN: '放大倍数，以markLine lineWidth为基准',
                descriptionEN: 'magnification. Based on markLine lineWidth.'
            },
            color: {
                type: 'color',
                defaultValueHTML: 'null',
                descriptionCN: '炫光颜色，默认跟随markLine itemStyle定义颜色',
                descriptionEN: 'color of the glow. The default value is pulled from the markLine itemStyle array. '
            },
            shadowColor: {
                type: 'color',
                defaultValueHTML: 'null',
                descriptionCN: '光影颜色，默认跟随color',
                descriptionEN: 'color of the shadow. The default value is pulled from the color array. '
            },
            shadowBlur: {
                type: 'number',
                defaultValueHTML: 'null',
                descriptionCN: '光影模糊度，默认根据scaleSize计算',
                descriptionEN: 'blur degree of shadow. The default value is based on scaleSize. '
            }
        };

        // markLine data
        var originData = properties.data;
        var data;
        var descCN = findDesc(docMainCN);
        var descEN = findDesc(docMainEN);
        properties.data = {oneOf: []};

        data = dtUtil.clone(originData);
        properties.data.oneOf.push(data);
        data.applicable = 'all';
        data.descriptionCN = '标注图形数据';
        data.descriptionEN = 'data of markLine';

        data = dtUtil.clone(originData);
        properties.data.oneOf.push(data);
        data.applicable = ['pie', 'radar', 'force', 'chord'];
        data.descriptionCN = descCN.pieLike;
        data.descriptionEN = descEN.pieLike;

        data = dtUtil.clone(originData);
        properties.data.oneOf.push(data);
        data.applicable = ['line', 'bar', 'k', 'scatter'];
        data.descriptionCN = descCN.lineLike;
        data.descriptionEN = descEN.lineLike;

        data = dtUtil.clone(originData);
        properties.data.oneOf.push(data);
        data.applicable = 'map';
        data.descriptionCN = descCN.mapLike;
        data.descriptionEN = descEN.mapLike;

        function findDesc(docMain) {
            var anchor = $(docMain.find('a[name=SeriesMarkLineData]')[0]).parent();

            return {
                pieLike: [
                    goNext(anchor, 1)[0].innerHTML,
                    goNext(anchor, 2)[0].innerHTML
                ].join(''),
                lineLike: [
                    goNext(anchor, 3)[0].innerHTML,
                    goNext(anchor, 4)[0].innerHTML,
                    goNext(anchor, 5)[0].innerHTML,
                    goNext(anchor, 6)[0].innerHTML
                ].join(''),
                mapLike: [
                    goNext(anchor, 7)[0].innerHTML,
                    goNext(anchor, 8)[0].innerHTML
                ].join('')
            };
        }
    }

    function completeItemStyle(schema) {
        schema.definitions.itemStyle = {
            type: 'Object',
            descriptionCN: '图形样式',
            descriptionEN: 'item style',
            properties: {
                normal: {
                    type: 'Object',
                    descriptionCN: '默认样式',
                    descriptionEN: 'normal item style',
                    '$ref': '#definitions/itemStyleItem'
                },
                emphasis: {
                    type: 'Object',
                    descriptionCN: '强调样式（悬浮时样式）',
                    descriptionEN: 'emphasis item style (when hovered)',
                    '$ref': '#definitions/itemStyleItem'
                }
            }
        };

        var properties = schema.definitions.itemStyleItem.properties;

        addRef(properties.lineStyle, '#definitions/lineStyle');
        addRef(properties.areaStyle, '#definitions/areaStyle');
        addRef(properties.chordStyle, '#definitions/chordStyle');
        addRef(properties.nodeStyle, '#definitions/nodeStyle');
        addRef(properties.linkStyle, '#definitions/linkStyle');
        addRef(properties.label, '#definitions/itemStyleLabel');
        addRef(properties.labelLine, '#definitions/itemStyleLabelLine');

        var labelProperties = schema.definitions.itemStyleLabel.properties;
        addRef(labelProperties.textStyle, '#definitions/textStyle');
        addRef(labelProperties.formatter, '#definitions/tooltip/properties/formatter');

        var labelLineProperties = schema.definitions.itemStyleLabelLine.properties;
        addRef(labelLineProperties.lineStyle, '#definitions/lineStyle');
    }

    function completeOthers(schema) {
        var properties;

        properties = schema.definitions.loadingOption.properties;
        addRef(properties.textStyle, '#definitions/textStyle');

        properties = schema.definitions.noDataLoadingOption.properties;
        addRef(properties.textStyle, '#definitions/textStyle');

    }

    return init;
});