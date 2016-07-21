
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

            /*var prevValue = 0;
            var data = AreaZoomChart.sdata.map(function(d) {
                    var d0 = AreaZoomChart.TimeParse(d[0]);
                    var currentVal = d[1];
                    var d1 = prevValue + currentVal;
                    prevValue = currentVal;
                    return [d0, d1];
                });*/
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

        static sdata = [
            ['2001-09-07',17078],
            ['2001-09-08',15322],
            ['2001-09-09',16522],
            ['2001-09-10',16905],
            ['2001-09-11',2541],
            ['2001-09-12',1],
            ['2001-09-13',1445],
            ['2001-09-14',7745],
            ['2001-09-15',9634],
            ['2001-09-16',12243],
            ['2001-09-17',13708],
            ['2001-09-18',13799],
            ['2001-09-19',14321],
            ['2001-09-20',14249],
            ['2001-09-21',14229],
            ['2001-09-22',12431],
            ['2001-09-23',13852],
            ['2001-09-24',14303],
            ['2001-09-25',14325],
            ['2001-09-26',14355],
            ['2001-09-27',14393],
            ['2001-09-28',14436],
            ['2001-09-29',12596],
            ['2001-09-30',13730],
            ['2001-10-01',14372],
            ['2001-10-02',14415],
            ['2001-10-03',14397],
            ['2001-10-04',14589],
            ['2001-10-05',14510],
            ['2001-10-06',12810],
            ['2001-10-07',13863],
            ['2001-10-08',14431],
            ['2001-10-09',14419],
            ['2001-10-10',14339],
            ['2001-10-11',14366],
            ['2001-10-12',14283],
            ['2001-10-13',12637],
            ['2001-10-14',13851],
            ['2001-10-15',14433],
            ['2001-10-16',14413],
            ['2001-10-17',14439],
            ['2001-10-18',14487],
            ['2001-10-19',14515],
            ['2001-10-20',12806],
            ['2001-10-21',13888],
            ['2001-10-22',14436],
            ['2001-10-23',14342],
            ['2001-10-24',14054],
            ['2001-10-25',14294],
            ['2001-10-26',14470],
            ['2001-10-27',12669],
            ['2001-10-28',13750],
            ['2001-10-29',14433],
            ['2001-10-30',14273],
            ['2001-10-31',13962],
            ['2001-11-01',14100],
            ['2001-11-02',14232],
            ['2001-11-03',12677],
            ['2001-11-04',13690],
            ['2001-11-05',14324],
            ['2001-11-06',14351],
            ['2001-11-07',14368],
            ['2001-11-08',14411],
            ['2001-11-09',14440],
            ['2001-11-10',12744],
            ['2001-11-11',13711],
            ['2001-11-12',13902],
            ['2001-11-13',14330],
            ['2001-11-14',14378],
            ['2001-11-15',14364],
            ['2001-11-16',13971],
            ['2001-11-17',12547],
            ['2001-11-18',13659],
            ['2001-11-19',14280],
            ['2001-11-20',14404],
            ['2001-11-21',14451],
            ['2001-11-22',10967],
            ['2001-11-23',11048],
            ['2001-11-24',12568],
            ['2001-11-25',13864],
            ['2001-11-26',14395],
            ['2001-11-27',14366],
            ['2001-11-28',13838],
            ['2001-11-29',14213],
            ['2001-11-30',14296],
            ['2001-12-01',12415],
            ['2001-12-02',13459],
            ['2001-12-03',14275],
            ['2001-12-04',14214],
            ['2001-12-05',14268],
            ['2001-12-06',14312],
            ['2001-12-07',14341],
            ['2001-12-08',12641],
            ['2001-12-09',13618],
            ['2001-12-10',14252],
            ['2001-12-11',14215],
            ['2001-12-12',14141],
            ['2001-12-13',14201],
            ['2001-12-14',14242],
            ['2001-12-15',12594],
            ['2001-12-16',13593],
            ['2001-12-17',14374],
            ['2001-12-18',14352],
            ['2001-12-19',14518],
            ['2001-12-20',14582],
            ['2001-12-21',14667],
            ['2001-12-22',12949],
            ['2001-12-23',13254],
            ['2001-12-24',11864],
            ['2001-12-25',12041],
            ['2001-12-26',14419],
            ['2001-12-27',14429],
            ['2001-12-28',14344],
            ['2001-12-29',12780],
            ['2001-12-30',13243],
            ['2001-12-31',12939],
            ['2002-01-01',13235],
            ['2002-01-02',13934],
            ['2002-01-03',13556],
            ['2002-01-04',14197],
            ['2002-01-05',12594],
            ['2002-01-06',13591],
            ['2002-01-07',14193],
            ['2002-01-08',14305],
            ['2002-01-09',14336],
            ['2002-01-10',14396],
            ['2002-01-11',14390],
            ['2002-01-12',12479],
            ['2002-01-13',13506],
            ['2002-01-14',14339],
            ['2002-01-15',14266],
            ['2002-01-16',14128],
            ['2002-01-17',14335],
            ['2002-01-18',14400],
            ['2002-01-19',12248],
            ['2002-01-20',13474],
            ['2002-01-21',14360],
            ['2002-01-22',14253],
            ['2002-01-23',14238],
            ['2002-01-24',14153],
            ['2002-01-25',14389],
            ['2002-01-26',12505],
            ['2002-01-27',13528],
            ['2002-01-28',14284],
            ['2002-01-29',14245],
            ['2002-01-30',13812],
            ['2002-01-31',13366],
            ['2002-02-01',14221],
            ['2002-02-02',12507],
            ['2002-02-03',13614],
            ['2002-02-04',14407],
            ['2002-02-05',13818],
            ['2002-02-06',13954],
            ['2002-02-07',14446],
            ['2002-02-08',14451],
            ['2002-02-09',12528],
            ['2002-02-10',13719],
            ['2002-02-11',14465],
            ['2002-02-12',14407],
            ['2002-02-13',14534],
            ['2002-02-14',14678],
            ['2002-02-15',14713],
            ['2002-02-16',12716],
            ['2002-02-17',13864],
            ['2002-02-18',14682],
            ['2002-02-19',14544],
            ['2002-02-20',14607],
            ['2002-02-28',14699],
            ['2002-03-01',14684],
            ['2002-03-02',12049],
            ['2002-03-03',13881],
            ['2002-03-04',14682],
            ['2002-03-05',14703],
            ['2002-03-06',14771],
            ['2002-03-07',14842],
            ['2002-03-08',14766],
            ['2002-03-09',12508],
            ['2002-03-10',13945],
            ['2002-03-11',14815],
            ['2002-03-12',14600],
            ['2002-03-13',14728],
            ['2002-03-14',14604],
            ['2002-03-15',14805],
            ['2002-03-16',12838],
            ['2002-03-17',14012],
            ['2002-03-18',14737],
            ['2002-04-15',14823],
            ['2002-04-16',14747],
            ['2002-04-17',14854],
            ['2002-04-18',14843],
            ['2002-04-19',14610],
            ['2002-04-20',12895],
            ['2002-04-21',14095],
            ['2002-04-22',14929],
            ['2002-04-23',14904],
            ['2002-04-24',14833],
            ['2002-04-25',14937],
            ['2002-04-26',14924],
            ['2002-04-27',12895],
            ['2002-04-28',13923],
            ['2002-04-29',14918],
            ['2002-04-30',14880],
            ['2002-05-01',14854],
            ['2002-05-02',14643],
            ['2002-05-03',14717],
            ['2002-05-04',12812],
            ['2002-05-05',14051],
            ['2002-05-06',14798],
            ['2002-05-07',14706],
            ['2002-05-08',14732],
            ['2002-05-09',14752],
            ['2002-05-10',14915],
            ['2002-05-11',12837],
            ['2002-05-12',13932],
            ['2002-05-13',14625],
            ['2002-05-14',14814],
            ['2002-05-15',14832],
            ['2002-05-17',14793],
            ['2002-05-18',12886],
            ['2002-05-19',14112],
            ['2002-05-20',14942],
            ['2002-05-21',14866],
            ['2002-05-22',14893],
            ['2002-05-23',14977],
            ['2002-05-24',14995],
            ['2002-05-25',12443],
            ['2002-05-26',12355],
            ['2002-05-27',14034],
            ['2002-05-28',14863],
            ['2002-05-29',14857],
            ['2002-05-30',14868],
            ['2002-05-31',14785],
            ['2002-06-01',12885],
            ['2002-06-02',14187],
            ['2002-06-03',14847],
            ['2002-06-04',14247],
            ['2002-06-05',14604],
            ['2002-06-06',14744],
            ['2002-06-07',15174],
            ['2002-06-08',13317],
            ['2002-06-09',14603],
            ['2002-06-10',15014],
            ['2002-06-11',14820],
            ['2002-06-12',15165],
            ['2002-06-13',15110],
            ['2002-06-14',15234],
            ['2002-06-15',13617],
            ['2002-06-16',14722],
            ['2002-06-17',15266],
            ['2002-06-18',15253],
            ['2002-06-19',15191],
            ['2002-06-20',15331],
            ['2002-06-21',15155],
            ['2002-06-22',13660],
            ['2002-06-23',14760],
            ['2002-06-24',15266],
            ['2002-06-25',15025],
            ['2002-06-26',14901],
            ['2002-06-27',14721],
            ['2002-06-28',15309],
            ['2002-06-29',13762],
            ['2002-06-30',14777],
            ['2002-07-01',15248],
            ['2002-07-02',15114],
            ['2002-07-03',15285],
            ['2002-07-04',12636],
            ['2002-07-05',12947],
            ['2002-07-06',13668],
            ['2002-07-07',14817],
            ['2002-07-08',15369],
            ['2002-07-09',15224],
            ['2002-07-10',15170]
        ];
    }
    
}