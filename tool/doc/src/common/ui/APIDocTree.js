/**
 * @file api doc tree
 * @author sushuang(sushuang@baidu.com)
 */
define(function (require) {

    var $ = require('jquery');
    var dtUtil = require('dt/util');
    var Component = require('dt/ui/Component');
    var encodeHTML = dtUtil.encodeHTML;

    // Constant
    var PATH_ATTR = 'data-item-path';
    var SLIDE_INTERVAL = 500;

    /**
     * @class
     * @extends dt/ui/Component
     */
    var TreeSelect = Component.extend({

        _define: {
            css: 'apidoctree',
            viewModel: function () {
                return {
                    /**
                     * 如果是dtUtil.ob则表示单选，其值对应于datasource中的value，表示选中的项。
                     * 如果是dtUtil.obHash则表示多选，其中：
                     *      obHash中的key对应于datasource中的value,
                     *      obHash中的value是boolean，表示是否选中。
                     */
                    selected: dtUtil.ob(),
                    /**
                     * hovered
                     */
                    hovered: dtUtil.ob(),
                    /**
                     * @type {Array.<Object>}
                     *
                     * 每项为：
                     * {
                     *  value: ..., // 不禁止value重复。如果重复，同value的项会同时被选中。
                     *  text: ...,
                     *  tooltip: ..., // 鼠标hover提示文字，如果需要的话，string。
                     *  tooltipEncodeHTML: ... // 文字是否要encdeHTML，默认为true。
                     *  children: [ {同构子项}, {}, ... ]
                     *  childrenPre: // children前文字，如 ": {"
                     *  childrenPost: // children后文字，如 "}"
                     *  childrenBrief: // chilren折叠时显示的文字，如 "..."
                     *  expanded: {boolean} 初始状态是展开还是折叠。默认折叠（false）
                     * }
                     * 不能有空项。value可为任意基本类型。
                     */
                    datasource: [],
                    /**
                     * 大小改变事件。展开折叠时触发。
                     */
                    resizeEvent: dtUtil.ob()
                };
            },
            viewModelPublic: ['selected', 'resizeEvent']
        },

        /**
         * @override
         */
        _init: function () {
            dtUtil.assert(dtUtil.obTypeOf(this._viewModel().selected));

            this._initContent();
            this._initTooltip();
            this._initChange();
            this._initMouse();
        },

        /**
         * @private
         */
        _getCss: function (type) {
            var suffix = ({
                item: '-i',
                thumb: '-thumb',
                text: '-text',
                textActive: '-text-active',
                textHover: '-text-hover',
                list: '-list',
                parent: '-parent',
                collapsed: '-collapsed',
                expanded: '-expanded',
                post: '-post'
            })[type || ''];

            return this.css() + suffix;
        },

        /**
         * @private
         */
        _initContent: function () {
            var itemCss = this._getCss('item');
            var parentCss = this._getCss('parent');
            var collapsedCss = this._getCss('collapsed');
            var expandedCss = this._getCss('expanded');
            var thumbCss = this._getCss('thumb');
            var textCss = this._getCss('text');
            var listCss = this._getCss('list');
            var postCss = this._getCss('post');
            var html = [];

            travelTreeList(
                this._viewModel().datasource,
                {
                    preList: function (treeList, thisPath, parent) {
                        // 第一层（树林的根）展开，其他默认收缩。
                        var display = (thisPath === '' || parent.expanded) ? '' : 'display:none';
                        html.push('<ul class="', listCss, '" style="', display, '">');
                    },
                    postList: function () {
                        html.push('</ul>');
                    },
                    preChildren: function (dataItem, thisPath) {
                        var otherCss = (dataItem.children && dataItem.children.length)
                            ? (parentCss + ' ' + (dataItem.expanded ? expandedCss : collapsedCss))
                            : '';
                        var dataPath = PATH_ATTR + '="' + thisPath + '" ';
                        var textHTML = encodeHTML(dataItem.text);
                        var childrenPreHTML = encodeHTML(dataItem.childrenPre || '');
                        var childrenPostHTML = encodeHTML(dataItem.childrenPost || '');
                        var childrenBriefHTML = encodeHTML(dataItem.childrenBrief || '');

                        html.push(
                            '<li class="', itemCss, ' ', otherCss, '" ', dataPath, '>',
                            '<i class="', thumbCss, '"></i>', // 展开收起的控制器。
                            '<span class="', textCss, '" ', dataPath,
                                ' data-text="', textHTML,
                                '" data-children-pre="', childrenPreHTML,
                                '" data-children-post="', childrenPostHTML,
                                '" data-children-brief="', childrenBriefHTML,
                                '">',
                                textHTML, childrenPreHTML, childrenBriefHTML, childrenPostHTML,
                            '</span>'
                        );
                    },
                    postChildren: function (dataItem, thisPath, parent, isLast) {
                        html.push('</li>');
                        if (isLast && parent && parent.childrenPost) {
                            html.push('<li class="' , postCss, '">', encodeHTML(parent.childrenPost), '</li>');
                        }
                    }
                }
            );

            this.el().innerHTML = html.join('');
        },

        /**
         * @private
         */
        _initTooltip: function () {
            var datasource = this._viewModel().datasource;
            var loc = {
                x: 0,
                y: -15,
                xAnchor: 'center',
                yAnchor: 'bottom'
            };

            this._disposable(dtUtil.bindTooltip({
                bindEl: this.el(),
                followMouse: true,
                selector: '.' + this._getCss('text'),
                location: loc,
                text: getText,
                encodeHTML: false // 在getText中处理encodeHTML
            }));

            function getText(itemEl) {
                var dataItem = findItemByPath(
                    datasource, $(itemEl).attr(PATH_ATTR)
                );

                var tooltipText = (dataItem || {}).tooltip;
                if (tooltipText != null) {
                    return dataItem.tooltipEncodeHTML !== false
                        ? encodeHTML(tooltipText) : tooltipText;
                }
                // tooltipText为空则不显示tooltip
            }
        },

        /**
         * @private
         */
        _initChange: function () {
            var viewModel = this._viewModel();
            var selOb = viewModel.selected;

            this._disposable(
                dtUtil.obSubscribe(selOb, updateViewByModel)
            );

            var $texts = this.$el().find('.' + this._getCss('text'));
            var obType = dtUtil.obTypeOf(selOb);
            var activeCss = this._getCss('textActive');

            // 设初始值
            updateViewByModel(selOb());

            function updateViewByModel(nextValue) {
                $texts.each(function () {
                    var $this = $(this);
                    var thisValue = findItemByPath(
                        viewModel.datasource, $this.attr(PATH_ATTR)
                    ).value;

                    $this[
                        (
                            obType === 'obHash'
                                ? nextValue[thisValue] // 多选情况
                                : thisValue === nextValue // 单选情况
                        )
                        ? 'addClass' : 'removeClass'
                    ](activeCss);
                });
            }
        },

        /**
         * @private
         */
        _initMouse: function () {
            var $el = this.$el();
            var viewModel = this._viewModel();
            var itemCss = this._getCss('item');
            var textHoverCss = this._getCss('textHover');
            var collapsedCss = this._getCss('collapsed');
            var expandedCss = this._getCss('expanded');
            var textCss = this._getCss('text');
            var thumbCss = this._getCss('thumb');
            var insUID = this.uid();
            var that = this;

            // 鼠标事件
            $el.on(this._event('mouseenter'), '.' + textCss, '.' + itemCss, onItemTextEnter);
            $el.on(this._event('mouseleave'), '.' + textCss, '.' + itemCss, onItemTextLeave);
            $el.on(this._event('click'), '.' + textCss, onItemTextClick);
            $el.on(this._event('click'), '.' + thumbCss, onThumbClick);

            function onItemTextEnter(e) {
                if (viewModel.disabled()) {
                    return;
                }
                var $item = $(this);
                $item.addClass(textHoverCss);
                viewModel.hovered(findItemByPath(
                    viewModel.datasource, $item.attr(PATH_ATTR)
                ));
            }

            function onItemTextLeave(e) {
                $(this).removeClass(textHoverCss);
                viewModel.hovered(null);
            }

            function onItemTextClick(e) {
                if (viewModel.disabled()) {
                    return;
                }
                viewModel.selected(
                    findItemByPath(
                        viewModel.datasource, $(this).attr(PATH_ATTR)
                    ).value,
                    dtUtil.valueInfo(dtUtil.valueInfo.CONFIRMED, insUID)
                );
            }

            function onThumbClick() {
                if (viewModel.disabled()) {
                    return;
                }

                var $itemEl = findItemEl.call(that, $(this));
                var $listEl = findElInItem.call(that, $itemEl, 'list');

                if (!$itemEl) {
                    return;
                }

                if ($itemEl.hasClass(collapsedCss)) {
                    $itemEl.removeClass(collapsedCss);
                    $itemEl.addClass(expandedCss);
                    $listEl.slideDown(SLIDE_INTERVAL, onSlideEnd); // 动画
                }
                else if ($itemEl.hasClass(expandedCss)) {
                    $itemEl.removeClass(expandedCss);
                    $itemEl.addClass(collapsedCss);
                    $listEl.slideUp(SLIDE_INTERVAL, onSlideEnd); // 动画
                }

                resetItemText.call(that, $itemEl);
            }

            function onSlideEnd() {
                // fire event
                that._viewModel().resizeEvent({});
            }
        },

        /**
         * 判断是否datasource中有某value
         *
         * @public
         * @param {*} value 给定的value
         * @return {Boolean} 是否有value
         */
        hasValue: function (value) {
            var has = false;

            travelTreeList(
                this._viewModel().datasource,
                {preChildren: visitItem}
            );

            function visitItem(dataItem) {
                if (dataItem.value === value) {
                    has = true;
                }
            }

            return has;
        }

    });

    /**
     * 深度优先遍历treeList。
     *
     * @inner
     * @param {Array.<Object>} treeList 被遍历的对象。
     * @param {Array.<Function>} callbacks 遍历过程中的回调处理函数。
     * @param {Function} callbacks.preList 访问本list前的处理函数，参数：
     *                                     {Array.<Object>} 本list。
     *                                     {string} path 当前节点的位置信息, 形如'4,1,5'
     * @param {Function} callbacks.postList 访问子孙前的处理，参数同preList。
     * @param {Function} callbacks.preChildren 访问子孙前的处理，参数：
     *                                     {Object} item 当前节点,
     *                                     {string} path 当前节点的位置信息, 形如'4,1,5'
     *                                     {boolean} isLast
     * @param {Function} callbacks.postChildren 访问子孙后的处理，参数同callbacks.preChildren
     * @param {string=} parentPath 父节点的位置信息, 形如'4,1,5'，递归内部使用。
     * @param {Object=} parent 若没有则可以不传
     */
    function travelTreeList(treeList, callbacks, parentPath, parent) {
        parentPath = (parentPath == null || parentPath === '')
            ? '' : (parentPath + ',');

        if (treeList && treeList.length) {
            callbacks.preList && callbacks.preList(treeList, parentPath, parent);

            for (var i = 0, len = treeList.length; i < len; i++) {
                var dataItem = treeList[i];
                var thisPath = parentPath + i;
                var isLast = i === len - 1;

                callbacks.preChildren && callbacks.preChildren(dataItem, thisPath, parent, isLast);
                travelTreeList(dataItem.children, callbacks, thisPath, dataItem); // 递归
                callbacks.postChildren && callbacks.postChildren(dataItem, thisPath, parent, isLast);
            }

            callbacks.postList && callbacks.postList(treeList, parentPath, parent);
        }
    }

    /**
     * @inner
     * @param {Array.<Object>} treeList 在这里面find。
     * @param {string} path 节点的位置信息, 形如'4,1,5'。
     * @return {Object=} 找到的节点对象，没找到返回空。
     */
    function findItemByPath(treeList, path) {
        path = path.split(',');
        treeList = treeList || [];
        var dataItem;

        for (var i = 0, len = path.length; i < len && treeList; i++) {
            dataItem = treeList[path[i]];
            treeList = (dataItem || {}).children;
        }

        return dataItem;
    }

    /**
     * 从item中某个el找到itemEl
     *
     * @inner
     * @this {Object} TreeSelect实例
     */
    function findItemEl($subEl) {
        var baseCss = this.css();
        var itemCss = this._getCss('item');

        while (!$subEl.hasClass(itemCss)) {
            if ($subEl.hasClass(baseCss)) {
                return null;
            }

            $subEl = $subEl.parent();
        }

        return $subEl;
    }

    /**
     * @inner
     * @this {Object} TreeSelect实例
     */
    function findElInItem($itemEl, cssName) {
        return $itemEl.find('> .' + this._getCss(cssName));
    }

    /**
     * @inner
     */
    function resetItemText($itemEl) {
        var $textEl = findElInItem.call(this, $itemEl, 'text');

        if ($itemEl.hasClass(this._getCss('collapsed'))) {
            $textEl[0].innerHTML = encodeHTML([
                $textEl.attr('data-text'),
                $textEl.attr('data-children-pre'),
                $textEl.attr('data-children-brief'),
                $textEl.attr('data-children-post')
            ].join(''));
        }
        else if ($itemEl.hasClass(this._getCss('expanded'))) {
            $textEl[0].innerHTML = encodeHTML([
                $textEl.attr('data-text'),
                $textEl.attr('data-children-pre')
            ].join(''));
        }
    }

    return TreeSelect;
});