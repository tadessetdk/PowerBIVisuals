
module powerbi.visuals {
    import SelectionManager = utility.SelectionManager;
    
    module SortOrderEnum {
        export var ASCENDING: string = 'Ascending';
        export var DESCENDING: string = 'Descending';

        export var type: IEnumType = createEnumType([
            { value: ASCENDING, displayName: ASCENDING },
            { value: DESCENDING, displayName: DESCENDING }
        ]);
    }

    export class DivergingStackedBar implements IVisual {
   
        public static capabilities: VisualCapabilities = {
            dataRoles: [
                {
                    name: 'Category',
                    kind: VisualDataRoleKind.Grouping,
                    displayName: 'Category',
                }, {
                    name: 'Series',
                    kind: VisualDataRoleKind.Grouping,
                    displayName: 'Series',
                }, {
                    name: 'Value',
                    displayName: 'Values',
                    kind: VisualDataRoleKind.Measure,
                    requiredTypes: [{ numeric: true }]
                },{
                    name: 'SortBy',
                    kind: VisualDataRoleKind.Measure,
                    displayName: 'Sort Values By',
                }
            ],
            dataViewMappings: [{
                conditions: [
                    { 'Category': { max: 5 }, 'Series': { max: 1 }, 'Value': { max: 1 }, 'SortBy': { max: 1 } }
                ], 
                categorical: {
                    categories: {
                        for: { in: 'Category' },
                        dataReductionAlgorithm: { top: {} }
                    },
                    values: {
                        group: {
                            by: 'Series',
                            select: [
                                { bind: { to: 'Value' } }
                            ],
                            dataReductionAlgorithm: { top: { } }
                        }
                    }
                }
            },
            {
                conditions: [
                    { 'Category': { max: 5 }, 'Series': { max: 1 }, 'Value': { max: 1 }, 'SortBy': { max: 1 } }
                ], 
                categorical: {
                    categories: {
                        for: { in: 'Category' },
                        dataReductionAlgorithm: { top: {} }
                    },
                    values: {
                        select: [
                            { bind: { to: 'SortBy' } }
                        ]
                    }
                }
            }],
            drilldown: { roles: ['Category'] },
            objects: {
                general: {
                    displayName: data.createDisplayNameGetter('Visual_General'),
                    properties: {
                        formatString: {
                            type: { formatting: { formatString: true } },
                        },
                    },
                },
                axisproperties: {
                    displayName: 'Axis',
                    properties: {
                        fontSize: {
                            description: 'Specify the font size of the axis text.',
                            type: { formatting: { fontSize: true } },
                            displayName: 'Text Size'
                        },
                        textColor: {
                            description: 'Specify the font color of the axis text.',
                            type: { fill: { solid: { color: true } } },
                            displayName: 'Text Color'
                        },
                        lineColor: {
                            description: 'Specify the color of the axes line.',
                            type: { fill: { solid: { color: true } } },
                            displayName: 'Line Color'
                        }
                    }
                },
                secondyaxisproperties: {
                    displayName: '2nd Y Axis',
                    properties: {
                        lineColor: {
                            description: 'Specify the color of the line.',
                            type: { fill: { solid: { color: true } } },
                            displayName: 'Line Color'
                        }
                    }
                },
                barproperties: {
                    displayName: 'Bar',
                    properties: {
                        fontSize: {
                            description: 'Specify the font size of the bar text.',
                            type: { formatting: { fontSize: true } },
                            displayName: 'Text Size'
                        },
                        textColor: {
                            description: 'Specify the font color of the bar text.',
                            type: { fill: { solid: { color: true } } },
                            displayName: 'Text Color'
                        },
                        fill: {
                            type: { fill: { solid: { color: true } } }
                        },
                    }
                },
                legendproperties: {
                    displayName: 'Legend',
                    properties: {
                        fontSize: {
                            description: 'Specify the font size of the legend text.',
                            type: { formatting: { fontSize: true } },
                            displayName: 'Text Size'
                        },
                        textColor: {
                            description: 'Specify the font color of the legend text.',
                            type: { fill: { solid: { color: true } } },
                            displayName: 'Text Color'
                        }
                    }
                },
                valuesortproperties: {
                    displayName: 'Value Sort',
                    properties: {
                        valueSortOrderDefault: {
                            description: 'Specify the default sort order for the values.',
                            type: { enumeration: SortOrderEnum.type },
                            displayName: 'Order'
                        }
                    }
                },
            }
        };

        private static VisualClassName = 'DivergingStackedBar';
        private static DefaultAxisFontSize = 9;
        private static DefaultAxisTextColor = '#000';
        private static DefaultBarFontSize = 10;
        private static DefaultBarTextColor = '#FFF';
        private static ValueDefaultSort = 'ASCENDING';
        private static DurationAnimations = 200;
        private static MinOpacity = 0.3;
        private static MaxOpacity = 1;

        private svg: D3.Selection;
        private rootElement: D3.Selection;
        private dataPoints;
    
        private colors: IDataColorPalette;
        private selectionManager: SelectionManager;
        private dataView: DataView;

        public init(options: VisualInitOptions): void {
            var element = options.element;
            this.selectionManager = new SelectionManager({ hostServices: options.host });
            this.rootElement = d3.select(element.get(0));
            this.svg = this.rootElement
                .append('svg')
                .classed(DivergingStackedBar.VisualClassName, true);
            this.colors = options.style.colorPalette.dataColors;
        }

        public update(options: VisualUpdateOptions) {
            if (!options.dataViews || !options.dataViews[0]) return; // or clear the view, display an error, etc.
           
            var dataView = options.dataViews[0];
            this.dataView = dataView;
            var sortOrder = this.getSortOrder();
            var data = DivergingStackedBar.converter(dataView, sortOrder, this.colors);
            var viewport = options.viewport;

            var margin = { top: 60, right: 20, bottom: 20, left: 100 };
            var width = viewport.width - margin.left - margin.right;
            var height = viewport.height - margin.top - margin.bottom;

            this.svg.selectAll('g').remove();
            var mainGroup = this.svg
                .attr('width', viewport.width)
                .attr('height', viewport.height)
                .attr('id', 'd3-plot')
            .append('g')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            if (width >10 && height>10){
                this.render(data, mainGroup, width, height);
            }    
        }

        private static converter(dataView: DataView, sortOrder: string, colors){
            var categoryDataView = dataView.categorical;
            var categoryValues = categoryDataView.values;
            var levels = categoryDataView.categories[0].values;
            var categoryColumn = categoryDataView.categories[0];
            var colorScale = colors.getNewColorScale();
            var colorHelper = new ColorHelper(colors, { objectName: 'barproperties', propertyName: 'fill' });
            return categoryValues.map(function(v){
                var sum = 0;
                return {
                    seriesValue: v.source.groupName, 
                    identity: SelectionIdBuilder.builder().withSeries(categoryValues, v).createSelectionId(), 
                    values: v.values.map(function(v1, i){
                        var level = levels[i];
                        var objects = categoryColumn.objects && categoryColumn.objects[i];
                        var color = objects && colorHelper.getColorForSeriesValue(objects, categoryColumn.identityFields, level)
                                    || colorScale.getColor(level).value;
                        sum += v1;
                        return { 
                            identity: SelectionIdBuilder.builder().withCategory(categoryColumn, i).createSelectionId(),
                            value: v1,
                            color: color,
                            categoryValue: level
                        }
                    })
                    .map(function(d){
                        d.percentage = d.value*100/sum;
                        return d;
                    })
                    .sort(function(x,y){ return (sortOrder === SortOrderEnum.ASCENDING) && (y.categoryValue - x.categoryValue) || (x.categoryValue - y.categoryValue) })
                }
            });
        }
        
        private getSortOrder(){
            //we need to look at the sort property to see whether we should do ascending or descending
            var sortOrder = DivergingStackedBar.ValueDefaultSort;
            if (this.dataView) {
                var objects = this.dataView.metadata.objects;
                if (objects) {
                    var groupProperty = objects['valuesortproperties'];
                    if (groupProperty) {
                        var object = <string>groupProperty['valueSortOrderDefault'];
                        if (object !== undefined)
                            sortOrder = object;
                    }
                }
            }

            return sortOrder;
        }

        private render(dataOptions, svg, width, height) {
            var data = dataOptions.map(function(d) { return { identity: d.identity, values: d.values } });
            var seriesValues = dataOptions.map(function(d) { return d.seriesValue });

            var y = d3.scale.ordinal()
                .rangeRoundBands([0, height], .3);

            var x = d3.scale.linear()
                .rangeRound([0, width]);

            var xAxis = d3.svg.axis()
                .scale(x)
                .orient('top');

            var yAxis = d3.svg.axis()
                .scale(y)
                .orient('left')

            data.forEach(function(d, index) {
                var mid = Math.ceil(d.values.length/2);
				var firstHalf = d.values.slice(0, mid); 
                var x0 = -1 * (firstHalf.reduce(function(p,c){ return c.percentage + p }, 0) - 0.5 * firstHalf[firstHalf.length - 1].percentage); 
                d.boxes = d.values.map(function(d1) { 
                    return {
                        seriesValue: seriesValues[index],
                        categoryValue: d1.categoryValue,
                        x0: x0, 
                        x1: x0 += +d1.percentage, 
                        n: +d1.value,
                        identity: d1.identity,
                        color: d1.color
                    }; 
                });
            });

            var min_val = d3.min(data, function(d) {
                return d.boxes[0].x0;
            });

            var max_val = d3.max(data, function(d) {
                return d.boxes[d.boxes.length - 1].x1;
            });

            x.domain([min_val, max_val]).nice();
            y.domain(seriesValues.map(function(s){ return s }));

            var fontSize = this.GetProperty('axisproperties', 'fontSize', DivergingStackedBar.DefaultAxisFontSize).toString() + 'pt';
            var textColor = this.GetPropertyColor('axisproperties', 'textColor', DivergingStackedBar.DefaultAxisTextColor);

            svg.append('g')
                .attr('class', 'x axis')
                .style('font-size', fontSize)
                .style('fill', textColor)
                .call(xAxis);

            svg.append('g')
                .attr('class', 'y axis')
                .style('font-size', fontSize)
                .style('fill', textColor)
                .call(yAxis)

            var vakken = svg.selectAll('.seriesValue')
                .data(data)
                .enter().append('g')
                .attr('class', 'bar')
                .attr('transform', function(d) { return 'translate(0,' + y(d.boxes[0].seriesValue) + ')'; });
            
            this.setSelectHandler(vakken);

            var bars = vakken.selectAll('rect')
                .data(function(d) { return d.boxes; })
                .enter().append('g').attr('class', 'subbar');

            this.dataPoints = data[0].boxes;

            bars.append('rect')
                .attr('height', y.rangeBand())
                .attr('x', function(d) { return x(d.x0); })
                .attr('width', function(d) { return x(d.x1) - x(d.x0); })
                .style('fill', function(d) { return d.color; });
           
            var barFontSize = this.GetProperty('barproperties', 'fontSize', DivergingStackedBar.DefaultBarFontSize).toString() + 'pt';
            var barTextColor = this.GetPropertyColor('barproperties', 'textColor', DivergingStackedBar.DefaultBarTextColor);
            
            bars.append('text')
                .attr('x', function(d) { return x(d.x0); })
                .attr('y', y.rangeBand()/2)
                .attr('dy', '0.5em')
                .attr('dx', '0.5em')
                .style('text-anchor', 'begin')
                .style('font-size', barFontSize)
                .style('fill', barTextColor)
                .text(function(d) { return d.n !== 0 && (d.x1-d.x0)>3 ? d.n : '' });

            vakken.insert('rect',':first-child')
                .attr('height', y.rangeBand())
                .attr('x', '1')
                .attr('width', width)
                .attr('fill-opacity', '0.7')
                .style('fill', '#F5F5F5')
                .attr('class', function(d,index) { return index%2==0 ? 'even' : 'uneven'; });

            var yAxisColor = this.GetPropertyColor('secondyaxisproperties', 'lineColor', DivergingStackedBar.DefaultAxisTextColor);
            
            svg.append('g')
                .attr('class', 'y2 axis')
            .append('line')
                .attr('x1', x(0))
                .attr('x2', x(0))
                .attr('y2', height)
                .style('fill', 'none')
                .style('stroke', yAxisColor)
                .style('shape-rendering', 'crispEdges');

            var startp = svg.append('g').attr('class', 'legendbox').attr('id', 'mylegendbox');
            var legend = startp.selectAll('.legend')
                .data(data[0].boxes)
                .enter().append('g')
                .attr('class', 'legend')
                .attr('transform', function(d, i) { return 'translate(' + i*100 + ',-55)'; });

            legend.append('rect')
                .attr('x', 0)
                .attr('width', 18)
                .attr('height', 18)
                .style('fill', function(d){ return d.color });

            var legendFontSize = this.GetProperty('legendproperties', 'fontSize', DivergingStackedBar.DefaultAxisFontSize).toString() + 'pt';
            var legendFontColor = this.GetPropertyColor('legendproperties', 'textColor', DivergingStackedBar.DefaultAxisTextColor);

            legend.append('text')
                .attr('x', 22)
                .attr('y', 9)
                .attr('dy', '.35em')
                .style('text-anchor', 'begin')
                .style('font-size', legendFontSize)
                .style('fill', legendFontColor)
                .text(function(d) { return d.categoryValue; });

            var left = 0;
            legend
                .attr('transform', function() { 
                    var translate = 'translate(' + left + ',-55)';
                    left += this.getBBox().width + 24;
                    return translate;
                });

            var axisColor = this.GetPropertyColor('axisproperties', 'lineColor', DivergingStackedBar.DefaultAxisTextColor);

            d3.selectAll('.axis path')
                .style('fill', 'none')
                .style('stroke', axisColor)
                .style('shape-rendering', 'crispEdges');
        }
        
        // This function retruns the values to be displayed in the property pane for each object.
        // Usually it is a bind pass of what the property pane gave you, but sometimes you may want to do
        // validation and return other values/defaults
         public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            var enumeration = new ObjectEnumerationBuilder();
            var objectName = options.objectName;

            switch (objectName) {
                case 'axisproperties':
                    var properties: VisualObjectInstance = {
                        objectName: objectName,
                        displayName: 'Axis Properties',
                        selector: null,
                        properties: {
                            textColor: this.GetPropertyColor(objectName, 'textColor', DivergingStackedBar.DefaultAxisTextColor),
                            fontSize: this.GetProperty(objectName, 'fontSize', DivergingStackedBar.DefaultAxisFontSize),
                            lineColor: this.GetPropertyColor(objectName, 'lineColor', DivergingStackedBar.DefaultAxisTextColor),
                        }
                    };
                    enumeration.pushInstance(properties);
                    break;

                case 'legendproperties':
                    var properties: VisualObjectInstance = {
                        objectName: objectName,
                        displayName: 'Legend Properties',
                        selector: null,
                        properties: {
                            textColor: this.GetPropertyColor(objectName, 'textColor', DivergingStackedBar.DefaultAxisTextColor),
                            fontSize: this.GetProperty(objectName, 'fontSize', DivergingStackedBar.DefaultAxisFontSize)
                        }
                    };
                    enumeration.pushInstance(properties);
                    break;

                case 'barproperties':
                    var properties: VisualObjectInstance = {
                        objectName: objectName,
                        displayName: 'Bar Properties',
                        selector: null,
                        properties: {
                            fontSize: this.GetProperty(objectName, 'fontSize', DivergingStackedBar.DefaultBarFontSize),
                            textColor: this.GetPropertyColor(objectName, 'textColor', DivergingStackedBar.DefaultBarTextColor)
                        }
                    };
                    enumeration.pushInstance(properties);

                    this.dataPoints.forEach(s => {
                        var properties: VisualObjectInstance = {
                            objectName: objectName,
                            displayName: s.categoryValue,
                            selector: ColorHelper.normalizeSelector(s.identity.getSelector()),
                            properties: {
                                fill: { solid: { color: s.color } }
                            },
                        }
                        enumeration.pushInstance(properties);
                    });

                    break;

                case 'valuesortproperties':
                    var properties: VisualObjectInstance = {
                        objectName: objectName,
                        displayName: 'Value Sort',
                        selector: null,
                        properties: {
                            valueSortOrderDefault: this.GetPropertyColor(objectName, 'valueSortOrderDefault', DivergingStackedBar.ValueDefaultSort),
                        }
                    };
                    enumeration.pushInstance(properties);
                    break;

                case 'secondyaxisproperties':
                    var properties: VisualObjectInstance = {
                        objectName: objectName,
                        displayName: '2nd Y Axis',
                        selector: null,
                        properties: {
                            lineColor: this.GetPropertyColor(objectName, 'lineColor', DivergingStackedBar.DefaultAxisTextColor),
                        }
                    };
                    enumeration.pushInstance(properties);
                    break;
            }
            
            return  enumeration.complete();
        }

        private setSelectHandler(selection: D3.Selection): void {
            this.setSelection(selection);
            selection.on("click", (d) => {
                this.selectionManager.select(d.identity, d3.event.ctrlKey).then((selectionIds: SelectionId[]) => {
                    this.setSelection(selection, selectionIds);
                });
                d3.event.stopPropagation();
            });
            this.rootElement.on("click", () => {
                this.selectionManager.clear();
                this.setSelection(selection);
            });
        }

        private setSelection(selection: D3.Selection, selectionIds?: SelectionId[]): void {
            selection.transition()
                .duration(DivergingStackedBar.DurationAnimations)
                .style("fill-opacity", DivergingStackedBar.MaxOpacity);

            if (!selectionIds || !selectionIds.length) return;
            
            selection
                .filter((selectionData) => {
                    return !selectionIds.some((selectionId: SelectionId) => { return selectionData.identity === selectionId; });
                })
                .transition()
                .duration(DivergingStackedBar.DurationAnimations)
                .style("fill-opacity", DivergingStackedBar.MinOpacity);
        }

        private GetProperty<T>(groupPropertyValue: string, propertyValue: string, defaultValue: T) {
            if (this.dataView) {
                var objects = this.dataView.metadata.objects;
                if (objects) {
                    var groupProperty = objects[groupPropertyValue];
                    if (groupProperty) {
                        var object = <T>groupProperty[propertyValue];
                        if (object !== undefined)
                            return object;
                    }
                }
            }
            return defaultValue;
        }

        private GetPropertyColor(groupPropertyValue: string, propertyValue: string, defaultValue: string) {
            if (this.dataView) {
                var objects = this.dataView.metadata.objects;
                if (objects) {
                    var groupProperty = objects[groupPropertyValue];
                    if (groupProperty) {
                        var object = groupProperty[propertyValue];
                        if (object !== undefined)
                            return object.solid.color;
                    }
                }
            }
           
            return defaultValue;
        }
    }
};