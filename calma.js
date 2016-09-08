// RENDERING FUNCTIONS
//***************************************
function renderFeatureProvenance(doc) { 
	// for now, just print it to console
	keys = Object.keys(doc)
	for (var k = 0; k < keys.length; k++) { 
		console.log(keys[k], ": ", doc[keys[k]]);
	}
}

function renderFeatureData(doc) { 
	// create array of @id's 
	var doc = doc["@graph"]
	var events = []
	var keys = Object.keys(doc)
	var perKeyDurations = {};
	for (var k = 0; k < keys.length; k++) { 
		events.push(doc[keys[k]]);
	}
	events = events.map(function(e) { 
		var rObj = e;
		rObj["eventOrder"] = parseInt(/#event_(\d+)$/.exec(e["@id"])[1]);
		return rObj
	})
	events = events.sort(function(a, b) { 
		return a["eventOrder"] - b["eventOrder"]
	});
	// for now, just print it to console
	console.log(events)
	// go through the featuresJsonLd list of objects BACKWARDS, doing subtractions to figure out durations
	for(var i = events.length-1; i >=0; i=i-1) {
		var onsetTime = parseFloat(events[i]["http://purl.org/NET/c4dm/event.owl#time"]["http://purl.org/NET/c4dm/timeline.owl#at"]["@value"].replace("PT", "").replace("S", ""))
		var label = events[i]["http://www.w3.org/2000/01/rdf-schema#label"]
		
		if (i < events.length-1) {
			var duration = parseFloat(events[i+1]["http://purl.org/NET/c4dm/event.owl#time"]["http://purl.org/NET/c4dm/timeline.owl#at"]["@value"].replace("PT", "").replace("S", ""))  - onsetTime ;
			if(label in perKeyDurations) { 
				// seen this key before, so increment the pre-existing duration
				perKeyDurations[label] += duration;
			}
			else { 
				// first time we see this key
				perKeyDurations[label] = duration;
			}

		}
			
	}
	keys = Object.keys(perKeyDurations);
	var data = [];
	for(var k = 0; k < keys.length; k++) { 
		data.push({ "Letter": keys[k], "Freq": perKeyDurations[keys[k]] });
	}

	// set the dimensions of the canvas
	var margin = {top: 10, right: 20, bottom: 90, left: 30},
		width = 330 - margin.left - margin.right,
		height = 380 - margin.top - margin.bottom;

	// set the ranges
	var x = d3.scale.ordinal().rangeRoundBands([0, width], .05);

	var y = d3.scale.linear().range([height, 0]);
	
	// define the axis
	var xAxis = d3.svg.axis()
		.scale(x)
		.orient("bottom")


	var yAxis = d3.svg.axis()
		.scale(y)
		.orient("left")
		.ticks(10);
		
	// add the SVG element
	var svg = d3.select("#featureGraph").append("svg")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom)
	  .append("g")
		.attr("transform", 
			  "translate(" + margin.left + "," + margin.top + ")");

	// load the data
	 //d3.json(featureData, function(error, data) {

		data.forEach(function(d) {
			d.Letter = d.Letter;
			d.Freq = +d.Freq;
		});

	  // scale the range of the data
	  x.domain(data.map(function(d) { return d.Letter; }));
	  y.domain([0, d3.max(data, function(d) { return d.Freq; })]);

	  // add axis
	  svg.append("g")
		  .attr("class", "x axis")
		  .attr("transform", "translate(0," + height + ")")
		  .call(xAxis)
		.selectAll("text")
		  .style("text-anchor", "end")
		  .attr("dx", "-.8em")
		  .attr("dy", "-.55em")
		  .attr("transform", "rotate(-90)" );

	  svg.append("g")
		  .attr("class", "y axis")
		  .call(yAxis)
		.append("text")
		  .attr("transform", "rotate(-90)")
		  .attr("y", 5)
		  .attr("dy", ".71em")
		  .style("text-anchor", "end")
		  .text("Duration");


	  // Add bar chart


	  svg.selectAll("bar")
		  .data(data)
		.enter().append("rect")
		  .attr("class", "bar")
		  .attr("x", function(d) { return x(d.Letter); })
		  .attr("width", x.rangeBand())
		  .attr("y", function(d) { return y(d.Freq); })
		  .attr("height", function(d) { return height - y(d.Freq); });
		
	
}

// JSON-LD EXTRACTION FUNCTIONS
//***************************************
function extractFeatureProvenance(error, doc) { 
	console.log("Extracting provenance");
	console.log(doc);
	var matches = [];
	for (var i = 0; i < doc.length; i++) { 
		
		// hunt for the element of type vamp:Transform (carries the prov info)
		if(doc[i]["@type"].indexOf("http://purl.org/ontology/vamp/Transform") !== -1) { 
			matches.push(doc[i]);
		}
	}
	// warn if unexpected number of matches
	if(matches.length == 0) { 
		console.log("Couldn't find vamp:Transform element:", doc)
	} else if (matches.length > 1) { 
		console.log("Found " + matches.length + " vamp:Transform elements: ", doc);
	}
	renderFeatureProvenance(matches[0]);
}


function obtainFeatureBlob(error, doc) { 
	console.log("Obtaining feature blob");
	var matches = [];
	for (var i = 0; i < doc.length; i++) { 
		// hunt for the feature blob
		var associated = doc[i]["http://calma.linkedmusic.org/vocab/feature_blob"];
		if(typeof associated !== 'undefined') { 
			matches.push(doc[i]["http://calma.linkedmusic.org/vocab/feature_blob"]);
		}
	}
	// warn if unexpected number of matches
	if(matches.length == 0) { 
		console.log("No feature blobs found: ", doc)
	} else if (matches.length > 1) { 
		console.log("Found " + matches.length + " feature blob entries: ", doc);
	}
	if(matches[0].length !== 1) { 
		console.log("Found " + matches[0].length + " feature blobs: ", matches[0]);
	}

	$.get(translateCalmaUriScheme(matches[0][0]["@id"])).fail(function(error) { 
		console.log("Failed to obtain feature blob " + matches[0][0] + ": ", error)
	}).success( function (blobTarBz2) { 
		// ask the server to untar for us
		$.get(translateCalmaUriScheme(matches[0][0]["@id"]).replace("calma_data", "calma_untar")).fail(
			function(error) { console.log("Error asking server to untar " + translateCalmaUriScheme(matches[0][0]["@id"]), error) }
		).success( function(featureJsonLd) { 
		// now render the feature data
			renderFeatureData(JSON.parse(featureJsonLd));
		});
	});
//	TarGZ.load(translateCalmaUriScheme(matches[0][0]["@id"]), 
//		function(onstream) { 
//			console.log("Got onstream: ", onstream)
//		},
//		function(onload) { 
//			console.log("Got onload: ", onload)
//		},
//		function(error) { 
//			console.log("Got error: ", error)
//		});

//		untar(blobTar).then(
//			function(extractedFiles) { 
//				if(extractedFiles.length !== 1) { 
//					console.log("Blob contained unexpected number of extracted files: ", extractedFiles);
//				}
//				turtleToJsonLd(extractedFiles[0].readAsString(), extractFeatureData, null);
//			}, 
//			function(error) { 
//				console.log("Error extracting files from blob: ", error);
//			}
//		);
//	});
}

function findSpecificAnalysis(error, doc, feature) {
	console.log("Looking for", feature);
	var matches = [];
	for (var i = 0; i < doc.length; i++) { 
		// hunt for match to requested feature
		var associated = doc[i]["http://www.w3.org/ns/prov#wasAssociatedWith"];
		if(typeof associated !== 'undefined') { 
			for(a = 0; a < associated.length; a++) { 
				if(associated[a]["@id"] === feature) { 
					matches.push(doc[i]["@id"]);
				}
			}
		}
	}
	// warn if unexpected number of matches
	if(matches.length == 0) { 
		console.log("No match found for ", feature)
	} else if (matches.length > 1) { 
		console.log("Found " + matches.length + " matches for ", feature);
	}
	// get feature data for first match
	matchUri = translateCalmaUriScheme(matches[0].replace(/#activity_.*$/, ".ttl"))
	console.log("Getting: ", matchUri);
	$.get(matchUri).fail(
		function(error) { console.log("Error getting " + matches[0] + ": " + error) }
	).success( function (turtle) { 
		// now extract the feature output
		// no point doing provenance as its included in feature output, so commenting for now:
		// turtleToJsonLd(turtle, extractFeatureProvenance, null);
		turtleToJsonLd(turtle, obtainFeatureBlob, null);
	});
}

// HELPER FUNCTIONS
//***************************************
function translateCalmaUriScheme(oldUri) { 
	return oldUri.replace(/calma.linkedmusic.org\/data/, "eeboo.oerc.ox.ac.uk/calma_data")
				 .replace(/^(.*)track_(..)(.*)$/, "$1$2/track_$2$3");
}

function turtleToJsonLd(turtle, jsonLdFunc, feature) { 
	// Parse the Turtle and serialise as NQuads (required by jsonld.js)
	var parser = N3.Parser();
	var writer = N3.Writer({format:'N-Quads'});
	parser.parse(turtle, function(error, triple, prefixes) { 
		if(triple) { 
			writer.addTriple(triple["subject"], triple["predicate"], triple["object"]);
		}
		else {
			// finished! 
			writer.end(function(error, nQuads) { 
				if(error) { 
					console.log("Error writing n-quads: ", error);
				}
				nQuadsToJsonLd(error, nQuads, jsonLdFunc, feature) });
		}
	});
}

function nQuadsToJsonLd(error, nQuads, jsonLdFunc, feature) { 
	if(error) { 
		console.log("Error converting from n-quads", error);
	}
	jsonld.fromRDF(nQuads, {format: 'application/nquads'}, function(err, doc) {
		jsonLdFunc(err, doc, feature);
	})
}


function getFeatureForTrack(feature, track) { 
	// Get the feature listing for this track
	$.get(track + "analyses.ttl", console.log("Trying...")).done(
		console.log("Done!")
	).fail(function(error) { console.log("Error getting the analyses.ttl:", error) 
	}).success(function(turtle) { turtleToJsonLd(turtle, findSpecificAnalysis, feature) });
}		


$(document).ready(function(){ 
	getFeatureForTrack("http://vamp-plugins.org/rdf/plugins/qm-vamp-plugins#qm-keydetector", "http://eeboo.oerc.ox.ac.uk/calma_data/02/track_02017ae6-6037-4cc3-9cd1-7760f6f713b5/");
})
