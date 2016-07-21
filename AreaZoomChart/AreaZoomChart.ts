
module powerbi.visuals {
    import SelectionManager = utility.SelectionManager;
    
    export class AreaZoomChart implements IVisual {
   
        public static capabilities: VisualCapabilities = {
            dataRoles: [
               {
                    name: 'Value',
                    displayName: 'Value',
                    kind: VisualDataRoleKind.GroupingOrMeasure,
                }
            ],
            dataViewMappings: [{
                conditions: [
                    {  'Value': { max: 2 }}
                ], 
                categorical: {
                    values: {
                        select: [
                            { bind: { to: 'Value' } }
                        ],
                        dataReductionAlgorithm: { top: { } }
                    },
                }
            }],
            objects: {
                initialzoom: {
                    displayName: 'Initial Zoom',
                    properties: {
                        start: {
                            description: 'Zoom start',
                            type: { formatting: { numeric: true } },
                            displayName: 'Zoom start'
                        },
                        end: {
                            description: 'Zoom end',
                            type: { formatting: { numeric: true } },
                            displayName: 'Zoom end'
                        }
                    }
                },
            }
        };

		//TODO: -if series is not datetime, no formatting needed. 
		//		-for datetime, user can pass formats for axis values and range text 
        private static VisualClassName = 'AreaZoomChart';
        private static YearFormat = d3.time.format('%Y-%m-%d');
        private static INITIAL_ZOOM_START = new Date(1999, 0, 1);
        private static INITIAL_ZOOM_END = new Date(2003, 0, 0);
      
        private svg: D3.Selection;
        private rootElement: D3.Selection;
        
        private selectionManager: SelectionManager;
        private dataView: DataView;

        public init(options: VisualInitOptions): void {
            var element = options.element;
            this.selectionManager = new SelectionManager({ hostServices: options.host });
            this.rootElement = d3.select(element.get(0));
            this.svg = this.rootElement
                .append('svg')
                .attr('class', AreaZoomChart.VisualClassName);
        }

        public update(options: VisualUpdateOptions) {
            if (!options.dataViews || !options.dataViews[0]) return;
            
            var dataView = options.dataViews[0];
            this.dataView = dataView;

            var viewport = options.viewport;
            var margin = { top: 0, right: 60, bottom: 60, left: 0 };
            var width = viewport.width - margin.left - margin.right;
            var height = viewport.height - margin.top - margin.bottom;

            this.svg.selectAll('g').remove();
            this.svg
                .attr('width', viewport.width)
                .attr('height', viewport.height)
            .append('g')
                .attr('class', 'main-group')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            var data = AreaZoomChart.converter(this.dataView);
            
            if (width>10 && height>10){
                this.render(data, width, height);
            }    
        }

        private static converter(dataView: DataView){
            var categories = dataView.categorical.categories;
			return categories[0].values.map(function(d, i) {
                return [d, categories[1].values[i]]
            });
        }

        private render(data, width, height){
            var mainGroup = this.svg.select('g.main-group');

            //scales
			//TODO: can we get the min/max from data?
            var zoomStart = this.GetProperty('initialzoom', 'start', AreaZoomChart.INITIAL_ZOOM_START);
            var zoomEnd = this.GetProperty('initialzoom', 'start', AreaZoomChart.INITIAL_ZOOM_END);
            
            var x = d3.time.scale().range([0, width]);
            x.domain([zoomStart, zoomEnd]);
            var y = d3.scale.linear().range([height, 0]);
            y.domain([0, d3.max(data, function(d) { return d[1]; })]);

            //area
            var area = d3.svg.area()
                .interpolate('step-after')
                .x(function(d) { return x(d[0]); })
                .y0(y(0))
                .y1(function(d) { return y(d[1]); });

            var line = d3.svg.line()
                .interpolate('step-after')
                .x(function(d) { return x(d[0]); })
                .y(function(d) { return y(d[1]); });

            //clip path   
            mainGroup.append('clipPath')
                .attr('id', 'clip')
              .append('rect')
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", width)
                .attr("height", height);

            //axes
            // TODO: 
			//var xOrient = this.GetProperty('axisproperties', 'xOrient', AreaZoomChart.X_ORIENT);
            //var yOrient = this.GetProperty('axisproperties', 'yOrient', AreaZoomChart.Y_ORIENT);
            // set tickSize based on orientation for each axis
            var xAxis = d3.svg.axis().scale(x).orient('bottom').tickSize(-height, 0).tickPadding(6);
            var yAxis = d3.svg.axis().scale(y).orient('right').tickSize(-width).tickPadding(6);

            mainGroup.append('g')
                .attr('class', 'y axis')
                .attr('transform', 'translate(' + width + ',0)');
    
            mainGroup.append('g')
                .attr('class', 'x axis')
                .attr('transform', 'translate(0,' + height + ')');

            //paths
            mainGroup.append('path')
                .attr('class', 'area')
                .attr('clip-path', 'url(#clip)')
                .style('fill-opacity', '0.5');
          
            mainGroup.append('path')
                .attr('class', 'line')
                .attr('clip-path', 'url(#clip)');

            //zoom rect
            var zoom = d3.behavior.zoom()
                        .x(x)
                        .scaleExtent([0.5, 10])
                        .on('zoom', draw);
                        
            mainGroup.append('rect')
                .attr('class', 'zoomer')
                .attr('width', width)
                .attr('height', height)
                .call(zoom);
				
            mainGroup.append('text')
                .attr('x', width/2)
                .attr('y', height+50)
                .attr('class', 'domain-text');

            mainGroup.select('path.area').data([data]);
            mainGroup.select('path.line').data([data]);
            
            draw();
            this.setStyles();

            function draw() {
                mainGroup.select('g.x.axis').call(xAxis);
                mainGroup.select('g.y.axis').call(yAxis);
                mainGroup.select('path.area,path.line').attr('d', area);
                mainGroup.select('path.line').attr('d', area);
				var formatter = (x.domain()[0] instanceof Date) && AreaZoomChart.YearFormat || function(d){return d};
				var domainRange = x.domain().map(formatter);
                mainGroup.select('text.domain-text').text(domainRange.join(' to '));
            }
        }

        private setStyles(){
            d3.selectAll('.axis')
                .style('shape-rendering', 'crispEdges');

            d3.selectAll('.axis path, .axis line')
                .style('fill', 'none')
                .style('stroke-width', '.5px');

            d3.selectAll('.x.axis path')
                .style('stroke', '#000');

            d3.selectAll('.x.axis line')
                .style('stroke', '#fff')
                .style('stroke-opacity', '.5');

            d3.selectAll('.y.axis line')
                .style('stroke', '#ddd');

			d3.selectAll('path.area')
                .style('fill', 'steelblue'); //var areaFill = this.GetProperty('areaproperties', 'fillColor', AreaZoomChart.AREA_FILL_COLOR);
				    
            d3.selectAll('path.line')
                .style('fill', 'none')
                .style('stroke', '#315a7d') //var lineColor = this.GetProperty('areaproperties', 'lineColor', AreaZoomChart.LINE_COLOR);
                .style('stroke-width', '.5px');

            d3.selectAll('rect.zoomer')
                .style('fill', 'none')
                .style('cursor', 'move')
                .style('pointer-events', 'all');
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

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            var enumeration = new ObjectEnumerationBuilder();
            var objectName = options.objectName;

            switch (objectName) {
                case 'initialzoom':
                    var properties: VisualObjectInstance = {
                        objectName: objectName,
                        displayName: 'Initial Zoom',
                        selector: null,
                        properties: {
                            start: this.GetProperty(objectName, 'start', AreaZoomChart.INITIAL_ZOOM_START),
                            end: this.GetProperty(objectName, 'end', AreaZoomChart.INITIAL_ZOOM_END)
                        }
                    };
                    enumeration.pushInstance(properties);
                    break;
            }
            
            return  enumeration.complete();
        }

    }    
}