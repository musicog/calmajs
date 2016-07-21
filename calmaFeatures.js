function renderFeatureProvenance(doc) { 
	// for now, just print it to console
	keys = Object.keys(doc)
	for (var k = 0; k < keys.length; k++) { 
		console.log(keys[k], ": ", doc[keys[k]]);
	}
}

function translateCalmaUriScheme(oldUri) { 
	return oldUri.replace(/calma.linkedmusic.org\/data/, "eeboo.oerc.ox.ac.uk/calma_data")
				 .replace(/^(.*)track_(..)(.*)$/, "$1$2/track_$2$3");
}

function extractFeatureProvenance(error, doc) { 
	console.log("Extracting provenance");
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
		// now extract the provenance and the feature output
		console.log(turtle);
		turtleToJsonLd(turtle, extractFeatureProvenance, null) 
	});
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
			writer.end(function(error, nQuads) { nQuadsToJsonLd(error, nQuads, jsonLdFunc, feature) });
		}
	});
}

function nQuadsToJsonLd(error, nQuads, jsonLdFunc, feature) { 
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
	featuresJsonLd = getFeatureForTrack("http://vamp-plugins.org/rdf/plugins/vamp-libxtract#spectral_centroid", "http://eeboo.oerc.ox.ac.uk/calma_data/02/track_02017ae6-6037-4cc3-9cd1-7760f6f713b5/");
})
