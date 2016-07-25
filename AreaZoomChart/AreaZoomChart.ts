
module powerbi.visuals {
    import SelectionManager = utility.SelectionManager;
    
    export class AreaZoomChart implements IVisual {
   
        public static capabilities: VisualCapabilities = {
            dataRoles: [
                {
                    name: 'Category',
                    displayName: 'Category',
                    kind: VisualDataRoleKind.Grouping
                },
                {
                    name: 'Value',
                    displayName: 'Value',
                    kind: VisualDataRoleKind.GroupingOrMeasure,
                }
            ],
            dataViewMappings: [{
                conditions: [
                    {  'Category': { max: 1 }, 'Value': { max: 1 }}
                ], 
                categorical: {
                    categories: {
                         for: { in: 'Category' },
                         dataReductionAlgorithm: { top: { count: 10000 } }
                    },
                    values: {
                        select: [
                            { bind: { to: 'Value' } }
                        ],
						dataReductionAlgorithm: { top: { count: 10000 } }
                    }
                }
            }],
            objects: {
                zoomproperties: {
                    displayName: 'zoomproperties',
                    properties: {
                        start: {
                            description: 'Zoom start',
                            type: { numeric: true },
                            displayName: 'Zoom start'
                        },
                        end: {
                            description: 'Zoom end',
                            type: { numeric: true },
                            displayName: 'Zoom end'
                        },
                        maxZoomLevel: {
                            description: 'Max Zoom Level',
                            type: { numeric: true },
                            displayName: 'Max Zoom Level'
                        }
                    }
                },
                areaproperties: {
                    displayName: 'Area',
                    properties: {
                        fillColor: {
                            description: 'Fill color',
                            type: { fill: { solid: { color: true } } },
                            displayName: 'Fill color'
                        },
                        lineColor: {
                            description: 'Line color',
                            type: { fill: { solid: { color: true } } },
                            displayName: 'Line color'
                        }
                    }
                },
                axisproperties: {
                    displayName: 'Axis',
                    properties: {
                        fontSize: {
                            description: 'Font size',
                            type: { formatting: { fontSize: true } },
                            displayName: 'Font size'
                        },
                        textColor: {
                            description: 'Text color',
                            type: { fill: { solid: { color: true } } },
                            displayName: 'Text color'
                        },
                        xAxisLineColor: {
                            description: 'X Axis Line color',
                            type: { fill: { solid: { color: true } } },
                            displayName: 'X Axis Line color'
                        },
                        yAxisLineColor: {
                            description: 'Y Axis Line color',
                            type: { fill: { solid: { color: true } } },
                            displayName: 'Y Axis Line color'
                        }
                    }
                },
                footertextproperties: {
                    displayName: 'Footer',
                    properties: {
                        fontSize: {
                            description: 'Font size',
                            type: { formatting: { fontSize: true } },
                            displayName: 'Font size'
                        },
                        textColor: {
                            description: 'Text color',
                            type: { fill: { solid: { color: true } } },
                            displayName: 'Text color'
                        }
                    }
                },
                trackerpropeties: {
                    displayName: 'Tracker',
                    properties: {
                        fontSize: {
                            description: 'Font size',
                            type: { formatting: { fontSize: true } },
                            displayName: 'Font size'
                        },
                        textColor: {
                            description: 'Text color',
                            type: { fill: { solid: { color: true } } },
                            displayName: 'Text color'
                        },
                        lineColor: {
                            description: 'Line color',
                            type: { fill: { solid: { color: true } } },
                            displayName: 'Line color'
                        }
                    }
                }
            }
        };

        private static DateFormat1 = d3.time.format('%Y-%m-%d');
        private static DateFormat2 = d3.time.format('%d/%m/%Y %I:%M%p');
        private static AREA_FILL_COLOR = '#4682b4';
        private static LINE_COLOR = '#315a7d';
        private static AXIS_FONT_SIZE = '10';
        private static AXIS_TEXT_COLOR = '#777';
        private static AXIS_LINE_COLOR = '#CCC';
        private static FOOTER_TEXT_COLOR = '#333';
        private static FOOTER_FONT_SIZE = '12';
        private static TRACKET_LINE_COLOR = '#ff611a';
        private static TRACKET_TEXT_COLOR = '#ff5000';
        private static TRACKET_FONT_SIZE = '14';
        private static MARGIN = { top: 20, right: 60, bottom: 60, left: 20 };
        private static MAX_ZOOM_LEVEL = 1024;

        private selectionManager: SelectionManager;
        private dataView: DataView;

        private svg: D3.Selection;
        private rootElement: D3.Selection;

        private mainGroup;
        private width;
        private height;
        private x;
        private y;
        private xAxis;
        private yAxis;
        private xMin;
        private xMax;
        private area;
        private line;
        private data;
        private zoom;
        private tHandle;

        public init(options: VisualInitOptions): void {
            var element = options.element;
            this.selectionManager = new SelectionManager({ hostServices: options.host });
            this.rootElement = d3.select(element.get(0));
            this.svg = this.rootElement
                .append('svg')
                .attr('class', 'AreaZoomChart');
        }

        public update(options: VisualUpdateOptions) {
            if (!options.dataViews || !options.dataViews[0]) return;
            
            var viewport = options.viewport;
            var margin = AreaZoomChart.MARGIN;
            this.width = viewport.width - margin.left - margin.right;
            this.height = viewport.height - margin.top - margin.bottom;

            if (this.width < 20 || this.height < 20) return;

            this.svg.selectAll('g').remove();
            this.svg
                .attr('width', viewport.width)
                .attr('height', viewport.height)
            .append('g')
                .attr('class', 'main-group')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            this.dataView = options.dataViews[0];
            this.data = AreaZoomChart.converter(this.dataView);
            this.render();
        }

        private static converter(dataView: DataView){
            var categories = dataView.categorical.categories;
            return categories[0].values.map(function(d, i) {
                return [d, categories[1].values[i]]
            })
            .sort((x,y)=> x[0]-y[0]);
        }

        private render(){
            this.mainGroup = this.svg.select('g.main-group');;
            this.createScales();
            this.createPaths();
            this.createAxes();
            this.createTracker();
            this.enableZoom();
            this.bindData();
            this.draw();
        }

        private createScales(){
            var data = this.data;
            this.xMin = d3.min(data, d=> d[0]);
            this.xMax = d3.max(data, d=> d[0]);
            var zoomStart = this.GetProperty('zoomproperties', 'start', this.xMin);
            var zoomEnd = this.GetProperty('zoomproperties', 'start', this.xMax);
            var isDateTimeSeries = data[0][0] instanceof Date;
            this.x = (isDateTimeSeries && d3.time.scale() || d3.scale.linear()).range([0, this.width]).nice().clamp(true);
            this.x.domain([zoomStart, zoomEnd]);
            this.y = d3.scale.linear().range([this.height, 0]).clamp(true);
            this.y.domain([0, d3.max(data, d=> d[1])]);
        }

        private createPaths(){
            //add clip
            this.createClip();

            //area
            var x = this.x, y = this.y;

            this.area = d3.svg.area()
                .interpolate('step-after')
                .x(d=> x(d[0]))
                .y0(y(0))
                .y1(d=> y(d[1]));
            
            //line
            this.line = d3.svg.line()
                .interpolate('step-after')
                .x(function(d) { return x(d[0]); })
                .y(function(d) { return y(d[1]); });
       
            this.mainGroup.append('clipPath')
                .attr('id', 'clip')
              .append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', this.width)
                .attr('height', this.height);
        }

        private createClip(){
             //paths
            this.mainGroup.append('path')
                .attr('class', 'area')
                .attr('clip-path', 'url(#clip)')
                .style('fill-opacity', '0.5');
          
            this.mainGroup.append('path')
                .attr('class', 'line')
                .attr('clip-path', 'url(#clip)');
        }

        private createAxes(){
           /*
            // TODO:
            var xOrient = this.GetProperty('axisproperties', 'xOrient', AreaZoomChart.X_ORIENT);
            var yOrient = this.GetProperty('axisproperties', 'yOrient', AreaZoomChart.Y_ORIENT);
            -set tickSize based on orientation for each axis
            */
            this.xAxis = d3.svg.axis().scale(this.x).orient('bottom').tickSize(-this.height, 0).tickPadding(6);
            this.yAxis = d3.svg.axis().scale(this.y).orient('right').tickSize(-this.width).tickPadding(6);

            this.mainGroup.append('g')
                .attr('class', 'y axis')
                .attr('transform', 'translate(' + this.width + ',0)');
    
            this.mainGroup.append('g')
                .attr('class', 'x axis')
                .attr('transform', 'translate(0,' + this.height + ')');
        }
        
        private enableZoom(){
            var maxZoomLevel = this.GetProperty('zoomproperties', 'maxZoomLevel', AreaZoomChart.MAX_ZOOM_LEVEL);
            var zoom = this.zoom = d3.behavior.zoom()
                        .x(this.x)
                        .y(this.y)
                        .scaleExtent([0.5, maxZoomLevel])
                        .on('zoom', ()=> this.draw());
                        
            this.mainGroup.append('rect')
                .attr('class', 'zoomer')
                .attr('width', this.width)
                .attr('height', this.height)
                .call(zoom);
				
            this.mainGroup.append('text')
                .attr('y', this.height + 48)
                .attr('class', 'footer-text');
        }

        private bindData(){
            ['area','line'].forEach(a=> this.mainGroup.select('path.' + a).data([this.data]));
        }

        private lastTr;
        private draw(){
            var x = this.x.domain();
            if(this.x(x[0]) === this.x(x[1])) {
                this.lastTr && this.zoom.translate(this.lastTr);
            }
            this.lastTr = this.zoom.translate();
            x = this.x.domain();
            var fdata = this.data.filter(d=> d[0] >= x[0] && d[0] <= x[1]);
            var yMax = d3.max(fdata, d=> d[1]);
            this.y.domain([0, yMax]);
            
            var mainGroup = this.mainGroup;
            mainGroup.select('g.x.axis').call(this.xAxis);
            mainGroup.select('g.y.axis').call(this.yAxis);
            mainGroup.select('path.area').attr('d', this.area);
            mainGroup.select('path.line').attr('d', this.line);
            var formatter = (this.x.domain()[0] instanceof Date) && AreaZoomChart.DateFormat1 || (d=> d);
            var domainRange = this.x.domain().map(formatter);
            mainGroup.select('text.footer-text').text(domainRange.join(' to '));
            mainGroup.select('text.tracker').text('');
            this.setStyles();
        }

        private createTracker(){
            var line = this.mainGroup
                .append('line')
                .style('fill', 'none')
                .style('stroke', this.GetProperty('trackerpropeties', 'lineColor', AreaZoomChart.TRACKET_LINE_COLOR))
                .style('stroke-dasharray', '3, 2')
                .attr('y1', 0)
                .attr('y2', this.height);

            var text = this.mainGroup
                .append('text')
                .attr('class', 'tracker')
                .style('font-size', this.GetProperty('trackerpropeties', 'fontSize', AreaZoomChart.TRACKET_FONT_SIZE))
                .style('fill', this.GetProperty('trackerpropeties', 'textColor', AreaZoomChart.TRACKET_TEXT_COLOR));
                
            var self = this;
            this.mainGroup.on('mousemove', function() {
                self.displayTrackerText(line, text, d3.mouse(this)[0]);        
            });
        }

        private displayTrackerText(line, text, px){
            text.html('');
            if(px >= 0 && px <= this.width){
                this.clearTrackerTimeout();
                line.attr('x1', px).attr('x2', px);
                this.tHandle = window.setTimeout(()=>{
                    var xVal = this.x.invert(px);
                    var filteredData = this.data.filter(d=> d[0] === xVal);
                    var dVal = filteredData.length && filteredData[0] || this.getTrackerValue(px);
                    this.updateTrackerText(dVal, px, text);
                    this.clearTrackerTimeout();
                }, 200);
            } else {
               this.clearTrackerTimeout();
            }
        }

        private updateTrackerText(dVal, px, text){
            if(!dVal) return;
           
            var self = this;
            var formattedX = (dVal[0] instanceof Date) && AreaZoomChart.DateFormat2(dVal[0]) || dVal[0];
            var span1 = text.append('tspan').text(dVal[1]);
            var span2 = text.append('tspan').text(formattedX);

            span2.each(function(){
                px += 2;
                var box = this.getBBox();
                var tWidth = box.width;
                var diff = px + tWidth - self.width;
                var x = diff > 0 && (px - diff) || px;
                span1.attr('x', x);
                span2.attr('x', x);
           
                var py = self.y(dVal[1]) - 8;
                var tHeight = box.height;
                span1.attr('y', py);
                span2.attr('y', py + tHeight + 4);
            });
        }

        private clearTrackerTimeout(){
             this.tHandle && window.clearTimeout(this.tHandle);
             this.tHandle = 0;
        }

        private getTrackerValue(px){
            var len = this.data.length;
            var left = 0, right = len - 1;
            var mid = Math.floor(len / 2);
            while(mid > 0 && mid < len){
                var x = this.data[mid][0];
                var pxMid = this.x(x);
                if(px === pxMid) return this.data[mid];
                else if(px < pxMid) right = mid - 1;
                else left = mid + 1;

                if(mid > 0){
                    var pxLeft = this.x(this.data[mid - 1][0]);
                    if(pxLeft <= px && px < pxMid) {
                        return this.data[mid - 1];
                    }
                } 
                if (mid < len - 1){
                    var pxRight = this.x(this.data[mid + 1][0]);
                    if(pxMid <= px && px < pxRight) {
                        return this.data[mid];
                    }
                }
                mid = Math.floor(left + (right - left)/2);
            }

            return null;
        }

        private setStyles(){
            d3.selectAll('.axis')
                .style('shape-rendering', 'crispEdges');

            d3.selectAll('.axis path, .axis line')
                .style('fill', 'none')
                .style('stroke-width', '.5px');

            d3.selectAll('.x.axis path')
                .style('stroke', this.GetProperty('axisproperties', 'xAxisLineColor', AreaZoomChart.AXIS_LINE_COLOR));

            d3.selectAll('.x.axis text, .y.axis text')
                .style('font-size', this.GetProperty('axisproperties', 'fontSize', AreaZoomChart.AXIS_FONT_SIZE))
                .style('fill', this.GetProperty('axisproperties', 'textColor', AreaZoomChart.AXIS_TEXT_COLOR));

            d3.selectAll('.x.axis line')
                .style('stroke', '#fff')
                .style('stroke-opacity', '.5');

            d3.selectAll('.y.axis line')
                .style('stroke', this.GetProperty('axisproperties', 'yAxisLineColor', AreaZoomChart.AXIS_LINE_COLOR));

            d3.selectAll('path.area')
                .style('fill', this.GetProperty('areaproperties', 'fillColor', AreaZoomChart.AREA_FILL_COLOR));
				    
            d3.selectAll('path.line')
                .style('fill', 'none')
                .style('stroke', this.GetProperty('areaproperties', 'lineColor', AreaZoomChart.LINE_COLOR))
                .style('stroke-width', '.5px');

            d3.selectAll('rect.zoomer')
                .style('fill', 'none')
                .style('cursor', 'move')
                .style('pointer-events', 'all');

            var footerText = d3.selectAll('text.footer-text');
            footerText
                .style('font-size', this.GetProperty('footertextproperties', 'fontSize', AreaZoomChart.FOOTER_FONT_SIZE))
                .style('fill', this.GetProperty('footertextproperties', 'textColor', AreaZoomChart.FOOTER_TEXT_COLOR));
            
            var self = this;
            footerText.each(function(){
                d3.select(this).attr('x', (self.width - this.getBBox().width) / 2);
            });
        }

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            var enumeration = new ObjectEnumerationBuilder();
            var objectName = options.objectName;

            switch (objectName) {
                case 'zoomproperties':
                    var properties: VisualObjectInstance = {
                        objectName: objectName,
                        displayName: 'Zoom',
                        selector: null,
                        properties: {
                            start: this.GetProperty(objectName, 'start', this.xMin),
                            end: this.GetProperty(objectName, 'end', this.xMax),
                            maxZoomLevel: this.GetProperty(objectName, 'maxZoomLevel', AreaZoomChart.MAX_ZOOM_LEVEL)
                        }
                    };
                    enumeration.pushInstance(properties);
                    break;

                case 'areaproperties':
                    var properties: VisualObjectInstance = {
                        objectName: objectName,
                        displayName: 'Area',
                        selector: null,
                        properties: {
                            fillColor: this.GetProperty(objectName, 'fillColor', AreaZoomChart.AREA_FILL_COLOR),
                            lineColor: this.GetProperty(objectName, 'lineColor', AreaZoomChart.LINE_COLOR)
                        }
                    };
                    enumeration.pushInstance(properties);
                    break;

                case 'axisproperties':
                    var properties: VisualObjectInstance = {
                        objectName: objectName,
                        displayName: 'Axis',
                        selector: null,
                        properties: {
                            fontSize: this.GetProperty(objectName, 'fontSize', AreaZoomChart.AXIS_FONT_SIZE),
                            textColor: this.GetProperty(objectName, 'textColor', AreaZoomChart.AXIS_TEXT_COLOR),
                            xAxisLineColor: this.GetProperty(objectName, 'xAxisLineColor', AreaZoomChart.AXIS_LINE_COLOR),
                            yAxisLineColor: this.GetProperty(objectName, 'yAxisLineColor', AreaZoomChart.AXIS_LINE_COLOR)
                        }
                    };
                    enumeration.pushInstance(properties);
                    break;

                case 'footertextproperties':
                    var properties: VisualObjectInstance = {
                        objectName: objectName,
                        displayName: 'Footer',
                        selector: null,
                        properties: {
                            fontSize: this.GetProperty(objectName, 'fontSize', AreaZoomChart.FOOTER_FONT_SIZE),
                            textColor: this.GetProperty(objectName, 'textColor', AreaZoomChart.FOOTER_TEXT_COLOR)
                        }
                    };
                    enumeration.pushInstance(properties);
                    break;

                case 'trackerpropeties':
                    var properties: VisualObjectInstance = {
                        objectName: objectName,
                        displayName: 'Tracker',
                        selector: null,
                        properties: {
                            fontSize: this.GetProperty(objectName, 'fontSize', AreaZoomChart.TRACKET_FONT_SIZE),
                            textColor: this.GetProperty(objectName, 'textColor', AreaZoomChart.TRACKET_TEXT_COLOR),
                            lineColor: this.GetProperty(objectName, 'lineColor', AreaZoomChart.TRACKET_LINE_COLOR)
                        }
                    };
                    enumeration.pushInstance(properties);
                    break;
            }
            
            return  enumeration.complete();
        }
        
        private GetProperty(groupPropertyValue: string, propertyValue: string, defaultValue) {
            if (this.dataView) {
                var objects = this.dataView.metadata.objects;
                if (objects) {
                    var groupProperty = objects[groupPropertyValue];
                    if (groupProperty) {
                        var object = groupProperty[propertyValue];
                        if (object !== undefined){
                            return object.solid && object.solid.color || object;
                        }
                    }
                }
            }
            return defaultValue;
        }
    }
}