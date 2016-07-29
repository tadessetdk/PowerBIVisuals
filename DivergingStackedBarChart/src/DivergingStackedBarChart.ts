
module powerbi.extensibility.visual {
    
    declare type d3 = any;
    declare var d3: d3;

    export class DivergingStackedBarChart implements IVisual {
   
        private static ASCENDING: string = "Ascending";
        private static VisualClassName = 'DivergingStackedBarChart';
        private static DefaultAxisFontSize = 9;
        private static DefaultAxisTextColor = '#CCC';
        private static DefaultBarFontSize = 14;
        private static DefaultBarTextColor = '#FFF';
        private static DefaultLegendTextColor = 'rgb(69, 106, 118)';
        private static Default2ndYAxixColor = 'rgb(135, 144, 146)';
        private static DurationAnimations = 200;
        private static MinOpacity = 0.3;
        private static MaxOpacity = 1;
        private static MARGIN = { top: 60, right: 20, bottom: 20, left: 100 };
            
        private svg;
        private rootElement;
        private dataPoints;
    
        private colors;
        private selectionManager: ISelectionManager;
        private dataView: DataView;
        private selectionIdBuilder: ISelectionIdBuilder;

        constructor(options: VisualConstructorOptions) {
            var element = options.element;
            this.selectionManager = options.host.createSelectionManager();
            this.rootElement = d3.select(element);
            this.svg = this.rootElement
                .append('svg')
                .classed(DivergingStackedBarChart.VisualClassName, true);
            this.colors = options.host.colors;
            this.selectionIdBuilder = options.host.createSelectionIdBuilder();
        }

        public update(options: VisualUpdateOptions) {
            if (!options.dataViews || !options.dataViews[0]) return; // or clear the view, display an error, etc.
            
            var viewport = options.viewport;
            var margin = DivergingStackedBarChart.MARGIN;
            var width = viewport.width - margin.left - margin.right;
            var height = viewport.height - margin.top - margin.bottom;
            if (width < 20 || height < 20) return; 
 
            this.svg.selectAll('g').remove();
            var mainGroup = this.svg
                .attr('width', viewport.width)
                .attr('height', viewport.height)
            .append('g')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            this.dataView = options.dataViews[0];
            var sortAscending = this.GetProperty('valuesortproperties', 'valueSortDirection', DivergingStackedBarChart.ASCENDING) === DivergingStackedBarChart.ASCENDING;
            var data = this.converter(sortAscending);
            this.render(data, mainGroup, width, height);
        }

        private converter(sortAscending: boolean){
            var categoryDataView = this.dataView.categorical; 
            var categoryValues = categoryDataView.values.grouped();
            var levels = categoryDataView.categories[0].values;
            var categoryColumn = categoryDataView.categories[0];
            var self = this;
            
            return categoryValues.map(v=> {
                var sum = 0;
                return {
                    seriesValue: v.name, 
                    identity: self.selectionIdBuilder.withSeries(categoryDataView.values, v).createSelectionId(), 
                    values: v.values[0].values.map((v1, i)=> {
                        var level = levels[i];
                        var objects = categoryColumn.objects && categoryColumn.objects[i];
                        var color = this.GetProperty('barproperties', level, this.colors[i].value);
                        // var color = objects && colorHelper.getColorForSeriesValue(objects, categoryColumn.identityFields, level);
                        sum += v1;
                        return { 
                            identity: self.selectionIdBuilder.withCategory(categoryColumn, i).createSelectionId(),
                            value: v1,
                            color: color,
                            categoryValue: level,
                            sortKey: (v.values.length > 1) && v.values[1].values[i] || 0,
                            percentage: 0
                        }
                    })
                    .map(d=>{
                        d.percentage = d.value*100/sum;
                        return d;
                    })
                    .sort((x,y)=> sortAscending && (y.sortKey - x.sortKey) || (x.sortKey - y.sortKey))
                }
            });
        }

        private render(dataOptions, svg, width, height) {
            var data = dataOptions.map(d=> { return { identity: d.identity, values: d.values } });
            var seriesValues = dataOptions.map(d=>  { return d.seriesValue });

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

            data.forEach((d, index)=> {
                var mid = Math.ceil(d.values.length/2);
				var firstHalf = d.values.slice(0, mid); 
                var x0 = -1 * (firstHalf.reduce((p,c)=> c.percentage + p, 0) - 0.5 * firstHalf[firstHalf.length - 1].percentage); 
                d.boxes = d.values.map(d1=> { 
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

            var min_val = d3.min(data, d=> d.boxes[0].x0);
            var max_val = d3.max(data, d=> d.boxes[d.boxes.length - 1].x1);

            x.domain([min_val, max_val]).nice();
            y.domain(seriesValues.map(s=> s ));

            var fontSize = this.GetProperty('axisproperties', 'fontSize', DivergingStackedBarChart.DefaultAxisFontSize).toString() + 'pt';
            var textColor = this.GetProperty('axisproperties', 'textColor', DivergingStackedBarChart.DefaultAxisTextColor);

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
                .attr('transform', d=>  'translate(0,' + y(d.boxes[0].seriesValue) + ')');
            
            this.setSelectHandler(vakken);

            var bars = vakken.selectAll('rect')
                .data(d=>  d.boxes)
                .enter().append('g').attr('class', 'subbar');

            this.dataPoints = data[0].boxes;

            bars.append('rect')
                .attr('height', y.rangeBand())
                .attr('x', d=> x(d.x0))
                .attr('width', d=> x(d.x1) - x(d.x0))
                .style('fill', d=> d.color);
           
            var barFontSize = this.GetProperty('barproperties', 'fontSize', DivergingStackedBarChart.DefaultBarFontSize).toString() + 'pt';
            var barTextColor = this.GetProperty('barproperties', 'textColor', DivergingStackedBarChart.DefaultBarTextColor);
            
            bars.append('text')
                .attr('x', d=> x(d.x0))
                .attr('y', y.rangeBand()/2)
                .style('text-anchor', 'begin')
                .style('font-size', barFontSize)
                .style('fill', barTextColor)
                .text(d=>  d.n !== 0 && (d.x1-d.x0)>3 ? d.n : '');

            vakken.insert('rect',':first-child')
                .attr('height', y.rangeBand())
                .attr('x', '1')
                .attr('width', width)
                .attr('fill-opacity', '0.7')
                .style('fill', '#F5F5F5')
                .attr('class', (d,index)=> index%2==0 ? 'even' : 'uneven');

            var yAxisColor = this.GetProperty('secondyaxisproperties', 'lineColor', DivergingStackedBarChart.Default2ndYAxixColor);
            
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
                .attr('transform', (d, i)=> 'translate(' + i*100 + ',-55)');

            legend.append('rect')
                .attr('x', 0)
                .attr('width', 18)
                .attr('height', 18)
                .style('fill', d=> d.color);

            var legendFontSize = this.GetProperty('legendproperties', 'fontSize', DivergingStackedBarChart.DefaultAxisFontSize).toString() + 'pt';
            var legendFontColor = this.GetProperty('legendproperties', 'textColor', DivergingStackedBarChart.DefaultLegendTextColor);

            legend.append('text')
                .attr('x', 22)
                .attr('y', 9)
                .attr('dy', '.35em')
                .style('text-anchor', 'begin')
                .style('font-size', legendFontSize)
                .style('fill', legendFontColor)
                .text(d=> d.categoryValue);

            var left = 0;
            legend
                .attr('transform', function() { 
                    var translate = 'translate(' + left + ',-55)';
                    left += this.getBBox().width + 24;
                    return translate;
                });

            var axisColor = this.GetProperty('axisproperties', 'lineColor', DivergingStackedBarChart.DefaultAxisTextColor);

            d3.selectAll('.axis path')
                .style('fill', 'none')
                .style('stroke', axisColor)
                .style('shape-rendering', 'crispEdges');

            d3.selectAll('.subbar').each(function(s){
				var rect = this.childNodes[0];
				var rx = parseInt(d3.select(rect).attr('x'));
                var rBox = rect.getBBox();
                var rHeight = rBox.height; 
                var rWidth = rBox.width;
                var text = this.childNodes[1];
                var tBox = text.getBBox();
                var tHeight = tBox.height; 
                var tWidth = tBox.width; 
                d3.select(text).attr('y', rHeight/2 + tHeight/4);
                d3.select(text).attr('x', rx + rWidth/2 - tWidth/2);
            });
        }
        
        // This function retruns the values to be displayed in the property pane for each object.
        // Usually it is a bind pass of what the property pane gave you, but sometimes you may want to do
        // validation and return other values/defaults
         public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            var instances = [];
            var objectName = options.objectName;

            switch (objectName) {
                case 'axisproperties':
                    var properties: VisualObjectInstance = {
                        objectName: objectName,
                        displayName: 'Axis',
                        selector: null,
                        properties: {
                            fontSize: this.GetProperty(objectName, 'fontSize', DivergingStackedBarChart.DefaultAxisFontSize),
                            textColor: this.GetProperty(objectName, 'textColor', DivergingStackedBarChart.DefaultAxisTextColor),
                            lineColor: this.GetProperty(objectName, 'lineColor', DivergingStackedBarChart.DefaultAxisTextColor),
                        }
                    };
                    instances.push(properties);
                    break;

                case 'legendproperties':
                    var properties: VisualObjectInstance = {
                        objectName: objectName,
                        displayName: 'Legend',
                        selector: null,
                        properties: {
                            fontSize: this.GetProperty(objectName, 'fontSize', DivergingStackedBarChart.DefaultAxisFontSize),
                            textColor: this.GetProperty(objectName, 'textColor', DivergingStackedBarChart.DefaultLegendTextColor)
                        }
                    };
                    instances.push(properties);
                    break;

                case 'barproperties':
                    var properties: VisualObjectInstance = {
                        objectName: objectName,
                        displayName: 'Bar',
                        selector: null,
                        properties: {
                            fontSize: this.GetProperty(objectName, 'fontSize', DivergingStackedBarChart.DefaultBarFontSize),
                            textColor: this.GetProperty(objectName, 'textColor', DivergingStackedBarChart.DefaultBarTextColor)
                        }
                    };
                    instances.push(properties);

                    this.dataPoints.forEach(s => {
                        var properties: VisualObjectInstance = {
                            objectName: objectName,
                            displayName: s.categoryValue,
                            selector: s.identity.getSelector(),
                            properties: {
                                fill: { solid: { color: s.color } }
                            },
                        }
                        instances.push(properties);
                    });

                    break;

                     case 'valuesortproperties':
                    var properties: VisualObjectInstance = {
                        objectName: objectName,
                        displayName: 'Sort Ascending',
                        selector: null,
                        properties: {
                            valueSortDirection: this.GetProperty(objectName, 'valueSortDirection', DivergingStackedBarChart.ASCENDING),
                        }
                    };
                    instances.push(properties);
                    break;

                case 'secondyaxisproperties':
                    var properties: VisualObjectInstance = {
                        objectName: objectName,
                        displayName: '2nd Y Axis',
                        selector: null,
                        properties: {
                            lineColor: this.GetProperty(objectName, 'lineColor', DivergingStackedBarChart.Default2ndYAxixColor),
                        }
                    };
                    instances.push(properties);
                    break;
            }
            
            return  instances;
        }

        private setSelectHandler(selection): void {
            this.setSelection(selection);
            selection.on("click", (d) => {
                this.selectionManager.select(d.identity, d3.event.ctrlKey).then((selectionIds: ISelectionId[]) => {
                    this.setSelection(selection, selectionIds);
                });
                d3.event.stopPropagation();
            });
            this.rootElement.on("click", () => {
                this.selectionManager.clear();
                this.setSelection(selection);
            });
        }

        private setSelection(selection, selectionIds?: ISelectionId[]): void {
            selection.transition()
                .duration(DivergingStackedBarChart.DurationAnimations)
                .style("fill-opacity", DivergingStackedBarChart.MaxOpacity);

            if (!selectionIds || !selectionIds.length) return;
            
            selection
                .filter(selectionData => !selectionIds.some((selectionId: ISelectionId) => selectionData.identity === selectionId))
                .transition()
                .duration(DivergingStackedBarChart.DurationAnimations)
                .style("fill-opacity", DivergingStackedBarChart.MinOpacity);
        }

        private GetProperty(groupPropertyName: string, propertyName: string, defaultValue) {
            if (this.dataView) {
                var objects = this.dataView.metadata.objects;
                if (objects) {
                    var groupProperty = objects[groupPropertyName];
                    if (groupProperty) {
                        var object = groupProperty[propertyName];
                        if (object !== undefined)
                            return object.solid && object.solid.color || object;
                    }
                }
            }
            return defaultValue;
        }
    }
};