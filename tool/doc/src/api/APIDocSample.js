/**
 * api doc sample
 */
define(function (require) {

    var $ = require('jquery');
    var Component = require('dt/ui/Component');
    var schemaHelper = require('../common/schemaHelper');
    var dtUtil = require('dt/util');

    require('../common/ui/componentConfig');

    var SCHEMA_URL = '../migrate/optionSchema.json';
    var TPL_TARGET = 'APIDocSample';
    var SELECTOR_DESC_CN = '.ecdoc-api-desc-cn div';
    var SELECTOR_DESC_EN = '.ecdoc-api-desc-en div';
    var SELECTOR_DEFAULT = '.ecdoc-api-default div';
    var SELECTOR_DEFAULT_EXPLANATION = '.ecdoc-api-default-explanation div';
    var SELECTOR_QUERY_AREA = '.ecdoc-api-query-area';
    var SELECTOR_QUERY_TAB = '.query-tab';
    var CSS_QUERY_TAB_ACTIVE = 'query-tab-active';
    var SELECTOR_QUERY_BOX = '.query-box';
    var SELECTOR_COLLAPSE_RADIO = '.query-collapse-radio input[type=radio]';
    var SELECTOR_RESET_BUTTON = '.reset-btn';

    /**
     * 编辑端入口
     *
     * @class
     * @extends dt/ui/Component
     */
    var APIDocSample = Component.extend({

        _define: {
            tpl: require('tpl!./doc.tpl.html'),
            css: 'ecdoc-apidoc',
            viewModel: function () {
                return {
                    apiTreeDatasource: null,
                    apiTreeSelected: dtUtil.ob(),
                    apiTreeHighlighted: dtUtil.obArray()
                };
            }
        },

        _prepare: function () {
            this._viewModel().apiTreeDatasource = [];

            // this._makeTestData();
            $.getJSON(SCHEMA_URL, $.proxy(this._handleSchemaLoaded, this));

        },

        _handleSchemaLoaded: function (schema) {
            var renderBase = {};
            schemaHelper.buildDoc(schema, renderBase);

            this._docTree = {
                value: 'root',
                text: 'option = ',
                childrenPre: '{',
                childrenPost: '}',
                childrenBrief: ' ... ',
                children: renderBase.children[0].children,
                expanded: true
            };

            var viewModel = this._viewModel();
            viewModel.apiTreeDatasource = [this._docTree];
            this._applyTpl(this.$el(), TPL_TARGET);

            this._disposable(
                this._sub('apiDocTree').viewModel('hovered')
                    .subscribe($.proxy(this._updateDesc, this, false))
            );
            this._disposable(
                this._sub('apiDocTree').viewModel('selected')
                    .subscribe($.proxy(this._updateDesc, this, true))
            );

            this._initQueryArea();
        },

        _makeTestData: function() {
            var apiTreeDatasource = this._viewModel().apiTreeDatasource = [];

            // For test
            apiTreeDatasource.push({
                value: 'root',
                text: 'option = ',
                tooltip: 'option root',
                childrenPre: '{',
                childrenPost: '}',
                children: [
                    makeItem([makeItem(), makeItem(), makeItem()]),
                    makeItem(),
                    makeItem([makeItem(), makeItem()])
                ]
            });

            function makeItem(children) {
                return {
                    value: 'option = ',
                    text: 'asdf' + Math.random(),
                    childrenPre: ': {',
                    childrenPost: '}',
                    childrenBrief: ' ... ',
                    children: children
                };
            }
        },

        _updateDesc: function (persistent, nextValue, ob) {
            var $el = this.$el();
            var treeItem = ob.peekValueInfo('dataItem');
            if (treeItem) {
                var desc = {
                    cnDesc: treeItem.descriptionCN || '无说明',
                    enDesc: treeItem.descriptionEN || 'No description',
                    defaultValue: dtUtil.encodeHTML(stringifyValue(treeItem.defaultValue)) || '',
                    defaultExplanation: treeItem.defaultExplanation || ''
                };

                if (persistent) {
                    this._desc = desc;
                }

                doShow(desc);
            }
            else if (this._desc) { // nothing hovered. restore
                doShow(this._desc);
            }

            function doShow(desc) {
                $el.find(SELECTOR_DESC_CN)[0].innerHTML = desc.cnDesc;
                $el.find(SELECTOR_DESC_EN)[0].innerHTML = desc.enDesc;
                $el.find(SELECTOR_DEFAULT)[0].innerHTML = desc.defaultValue;
                $el.find(SELECTOR_DEFAULT_EXPLANATION)[0].innerHTML = desc.defaultExplanation;
            }
        },

        _initQueryArea: function () {
            var $area = $(SELECTOR_QUERY_AREA);
            var that = this;
            $(SELECTOR_QUERY_TAB).on('click', function () {
                var $tab = $(this);
                var $target = $area.find($tab.attr('data-box'));
                $area.find(SELECTOR_QUERY_TAB).removeClass(CSS_QUERY_TAB_ACTIVE);
                $tab.addClass(CSS_QUERY_TAB_ACTIVE);
                $area.find(SELECTOR_QUERY_BOX).hide();
                $target.show();
            });

            $area.find(SELECTOR_QUERY_BOX).each(function () {
                var $box = $(this);
                var queryArgName = $box.attr('data-arg-name');
                $box.find('.query-btn').on('click', function () {
                    var queryStr = $.trim($(this).prev().val());
                    that.doQuery(queryStr, queryArgName);
                });
            });

            $area.find(SELECTOR_RESET_BUTTON).on('click', function () {
                that._viewModel().apiTreeSelected(null, {collapseLevel: 1});
                that._viewModel().apiTreeHighlighted([], {collapseLevel: 1});
            });
        },

        /**
         * 检索并对应到树的相应选项上
         * queryStr like 'series[i](applicable:pie,line).itemStyle.normal.borderColor'
         */
        doQuery: function (queryStr, queryArgName) {
            var result;

            try {
                var args = {};
                args[queryArgName] = queryStr;
                result = schemaHelper.queryDocTree(this._docTree, args);
            }
            catch (e) {
                alert(e);
                return;
            }

            var collapseLevel = null;
            $(SELECTOR_COLLAPSE_RADIO).each(function () {
                if (this.checked && this.value === '1') {
                    collapseLevel = 2;
                }
            });

            if (!result.length) {
                alert('没有检索到。queryStr="' + queryStr + '"');
                return;
            }

            var valueSet = [];
            for (var i = 0, len = result.length; i < len; i++) {
                valueSet.push(result[i].value);
            }

            this._viewModel().apiTreeHighlighted(
                valueSet, {scrollToTarget: true, collapseLevel: collapseLevel}
            );

            console.log(result);
        }
    });

    function stringifyValue(value) {
        try {
            return JSON.stringify(value);
        }
        catch (e) {
        }
        return value + '';
    }

    return APIDocSample;
});
