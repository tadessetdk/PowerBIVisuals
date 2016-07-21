
var m = [79, 80, 160, 79],
    w = 1280 - m[1] - m[3],
    h = 800 - m[0] - m[2],
    parse = d3.time.format("%Y-%m-%d").parse,
    format = d3.time.format("%Y");

// Scales. Note the inverted domain for the y-scale: bigger is up!
var x = d3.time.scale().range([0, w]),
    y = d3.scale.linear().range([h, 0]),
    xAxis = d3.svg.axis().scale(x).orient("bottom").tickSize(-h, 0).tickPadding(6),
    yAxis = d3.svg.axis().scale(y).orient("right").tickSize(-w).tickPadding(6);

// An area generator.
var area = d3.svg.area()
    .interpolate("step-after")
    .x(function(d) { return x(d.date); })
    .y0(y(0))
    .y1(function(d) { return y(d.value); });

// A line generator.
var line = d3.svg.line()
    .interpolate("step-after")
    .x(function(d) { return x(d.date); })
    .y(function(d) { return y(d.value); });

var svg = d3.select("body").append("svg:svg")
    .attr("width", w + m[1] + m[3])
    .attr("height", h + m[0] + m[2])
  .append("svg:g")
    .attr("transform", "translate(" + m[3] + "," + m[0] + ")");

var gradient = svg.append("svg:defs").append("svg:linearGradient")
    .attr("id", "gradient")
    .attr("x2", "0%")
    .attr("y2", "100%");

gradient.append("svg:stop")
    .attr("offset", "0%")
    .attr("stop-color", "#fff")
    .attr("stop-opacity", .5);

gradient.append("svg:stop")
    .attr("offset", "100%")
    .attr("stop-color", "#999")
    .attr("stop-opacity", 1);

svg.append("svg:clipPath")
    .attr("id", "clip")
  .append("svg:rect")
    .attr("x", x(0))
    .attr("y", y(1))
    .attr("width", x(1) - x(0))
    .attr("height", y(0) - y(1));

svg.append("svg:g")
    .attr("class", "y axis")
    .attr("transform", "translate(" + w + ",0)");

svg.append("svg:path")
    .attr("class", "area")
    .attr("clip-path", "url(#clip)")
    .style("fill", "url(#gradient)");

svg.append("svg:g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + h + ")");

svg.append("svg:path")
    .attr("class", "line")
    .attr("clip-path", "url(#clip)");

svg.append("svg:rect")
    .attr("class", "pane")
    .attr("width", w)
    .attr("height", h)
    .call(d3.behavior.zoom().on("zoom", zoom));

d3.csv("flights-departed.csv", function(data) {

  // Parse dates and numbers.
  data.forEach(function(d) {
    d.date = parse(d.date);
    d.value = +d.value;
  });

  // Compute the maximum price.
  x.domain([new Date(1999, 0, 1), new Date(2003, 0, 0)]);
  y.domain([0, d3.max(data, function(d) { return d.value; })]);

  // Bind the data to our path elements.
  svg.select("path.area").data([data]);
  svg.select("path.line").data([data]);

  draw();
});

function draw() {
  svg.select("g.x.axis").call(xAxis);
  svg.select("g.y.axis").call(yAxis);
  svg.select("path.area").attr("d", area);
  svg.select("path.line").attr("d", line);
  d3.select("#footer span").text("U.S. Commercial Flights, " + x.domain().map(format).join("-"));
}

function zoom() {
  d3.event.transform(x); // TODO d3.behavior.zoom should support extents
  draw();
}
