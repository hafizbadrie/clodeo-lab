var url = "http://localhost:3001/sock";
var sockjs = new SockJS(url);

$(document).ready(function() {
	$("#paint-mode").button("toggle");

	var add_image = document.getElementById("add-image");
	var remove_image = document.getElementById("remove-image");
	var clear_canvas = document.getElementById("clear-canvas");
	var paint_btn = document.getElementById("paint-mode");
	var drag_btn = document.getElementById("drag-mode");
	var erase_btn = document.getElementById("erase-mode");
	var paint_canvas = document.getElementById("paint-canvas");
	var save_canvas = document.getElementById("save-canvas");
	var record_canvas = document.getElementById("record-canvas");
	var load_canvas = document.getElementById("load-canvas");
	var imaged, paint_mode, drag_mode, erase_mode, freeze_mode;
	var stage = new Kinetic.Stage({
		container:"paint-canvas",
		width:940,
		height:550
	});
	var canvas, ctx, layer, group;
	var is_painting = false;
	var images = [];
	var img_idx = 0;
	var draw_points = [];
	var left_offset;
	var temp_group;
	var memcard;
	var activities = new Array();
	var points = new Array();
	var line_name;

	function init_variable() {
		imaged = false;
		paint_mode = true;
		drag_mode = false;
		erase_mode = false;
		freeze_mode = false;
		layer = new Kinetic.Layer();
		group = new Kinetic.Group();
		layer.add(group);
	};

	function init() {
		stage.add(layer);
		canvas = paint_canvas.getElementsByTagName('canvas')[0];
		ctx = canvas.getContext('2d');
	}

	function resize(activeAnchor) {
		var group = activeAnchor.getParent();

		var topLeft = group.get('.top_left')[0];
		var topRight = group.get('.top_right')[0];
		var bottomRight = group.get('.bottom_right')[0];
		var bottomLeft = group.get('.bottom_left')[0];
		var image = group.get('.image')[0];

		var anchorX = activeAnchor.getX();
		var anchorY = activeAnchor.getY();

		// update anchor positions
		switch (activeAnchor.getName()) {
			case 'top_left':
				topRight.setY(anchorY);
				bottomLeft.setX(anchorX);
			break;
			case 'top_right':
				topLeft.setY(anchorY);
				bottomRight.setX(anchorX);
			break;
			case 'bottom_right':
				bottomLeft.setY(anchorY);
				topRight.setX(anchorX); 
			break;
			case 'bottom_left':
			    bottomRight.setY(anchorY);
			    topLeft.setX(anchorX); 
		    break;
		}

		image.setPosition(topLeft.getPosition());

		var width = topRight.getX() - topLeft.getX();
		var height = bottomLeft.getY() - topLeft.getY();
		if(width && height) {
		  image.setSize(width, height);
		}
	}

	function add_anchor(child_group, x, y, name) {
		var stage = child_group.getStage();
	    var layer = child_group.getLayer();

	    var anchor = new Kinetic.Circle({
			x: x,
			y: y,
			stroke: '#666',
			fill: '#ddd',
			strokeWidth: 2,
			radius: 5,
			name: name,
			draggable: true,
			visible:false,
			dragOnTop: false
	    });

	    anchor.on('dragmove', function() {
			resize(this);
			layer.draw();
	    });
	    anchor.on('mousedown touchstart', function() {
			child_group.setDraggable(false);
			this.moveToTop();
	    });
	    anchor.on('dragend', function() {
			child_group.setDraggable(true);
			layer.draw();
	    });
	    // add hover styling
	    anchor.on('mouseover', function() {
			var layer = this.getLayer();
			document.body.style.cursor = 'pointer';
			this.setStrokeWidth(4);
			layer.draw();
	    });
	    anchor.on('mouseout', function() {
			var layer = this.getLayer();
			document.body.style.cursor = 'default';
			this.setStrokeWidth(2);
			layer.draw();
	    });

	    child_group.add(anchor);
	}

	function draw_image(image_obj) {
		var layers = stage.getChildren();
		var groups = layers[0].getChildren();
		var child_group = new Kinetic.Group({
			draggable:drag_mode
		})
		groups[0].add(child_group);

		var image = new Kinetic.Image({
			image: image_obj,
			x: 10,
			y: 10,
			name:'image'
		});
		child_group.add(image);

		if (img_idx == 0) {
			add_anchor(child_group, 10, 10, 'top_left');
			add_anchor(child_group, 448, 10, 'top_right');
			add_anchor(child_group, 10, 448, 'bottom_left');
			add_anchor(child_group, 448, 448, 'bottom_right');
		} else {
			add_anchor(child_group, 10, 10, 'top_left');
			add_anchor(child_group, 405, 10, 'top_right');
			add_anchor(child_group, 10, 510, 'bottom_left');
			add_anchor(child_group, 405, 510, 'bottom_right');
		}

		child_group.on('mouseover', function() {
			if (drag_mode && !freeze_mode) {
				var children = this.getChildren();
				for(i=0; i<children.length; i++) {
					if (children[i] instanceof Kinetic.Circle) {
						children[i].setVisible(true);
					}
				}
				layer.draw();
			}
		})

		child_group.on('mouseout', function() {
			if (drag_mode && !freeze_mode) {
				var children = this.getChildren();
				for(i=0; i<children.length; i++) {
					if (children[i] instanceof Kinetic.Circle) {
						children[i].setVisible(false);
					}
				}
				layer.draw();
			}
		})

		child_group.on('dblclick', function() {
			if (drag_mode) {
				freeze_mode = !freeze_mode;
				var children = this.getChildren();
				if (freeze_mode) {
					temp_group = this;
					for(i=0; i<children.length; i++) {
						if (children[i] instanceof Kinetic.Circle) {
							children[i].setVisible(true);
						}
					}
					layer.draw();
				} else {
					temp_group = undefined;
					for(i=0; i<children.length; i++) {
						if (children[i] instanceof Kinetic.Circle) {
							children[i].setVisible(false);
						}
					}
					layer.draw();
				}
			}
		})

		img_idx++;

		stage.draw();

		images.push(image);
	};

	init_variable();
	init();

	document.onmousedown = function(e) {
		var elm = e.target;
		if (elm.nodeName == "CANVAS") {
			if (paint_mode || erase_mode) {
				is_painting = true;
				left_offset = document.getElementsByClassName('container')[0].offsetLeft;
				draw_points = [e.pageX-left_offset, e.pageY-50];
				var layers = stage.getChildren();
				var groups = layers[0].getChildren();

				if (erase_mode) {
					var red_line = new Kinetic.Line({
						points:draw_points,
						stroke: 'white',
						strokeWidth: 8,
						lineCap: 'round',
						lineJoin: 'round'
					});
				} else {
					line_name = "line_" + Date.now();
					var red_line = new Kinetic.Line({
						points:draw_points,
						stroke: 'red',
						strokeWidth: 5,
						lineCap: 'round',
						lineJoin: 'round',
						name: line_name
					});
				}
				groups[0].add(red_line);

				/* save activity */
				points.push({x:e.pageX-left_offset, y:e.pageY-50});
				sockjs.send(JSON.stringify({name:line_name, x:e.pageX-left_offset, y:e.pageY-50, type:"paint"}));
			}
		}
	}

	document.onmousemove = function(e) {
		var elm = e.target;
		if (elm.nodeName == "CANVAS") {
			if (is_painting && (paint_mode || erase_mode)) {
				left_offset = document.getElementsByClassName('container')[0].offsetLeft;
				draw_points.push(e.pageX-left_offset);
				draw_points.push(e.pageY-50);

				var layers = stage.getChildren();
				var groups = layers[0].getChildren();
				var red_lines = groups[0].getChildren();
				red_lines[red_lines.length - 1].setPoints(draw_points);
				stage.draw();

				/* save activity */
				points.push({x:e.pageX-left_offset, y:e.pageY-50});
				sockjs.send(JSON.stringify({name:line_name, x:e.pageX-left_offset, y:e.pageY-50, type:"paint"}));
			}
		}
	}

	document.onmouseup = function(e) {
		var elm = e.target;
		if (elm.nodeName == "CANVAS") {
			if (paint_mode || erase_mode) {
				is_painting = false;

				/* save activity */
				var activity = "paint";
				var color = "red";
				var width = 5;
				if (erase_mode) {
					activity = "erase";
					color = "white";
					width = 8;
				}

				var savecard = {
					activity:activity,
					points:points,
					color:color,
					width:8
				}
				activities.push(savecard);
				points = [];
				line_name = "";
			}
		}
	}

	add_image.onclick = function () {
		var image_obj = new Image();
		if (img_idx == 0) {
			image_obj.src = "assets/idoh.jpeg";
		} else {
			image_obj.src = "assets/cat-thinking.jpg";
		}

		image_obj.onload = function() {
			draw_image(this);
		};

		imaged = true;
	};

	remove_image.onclick = function() {
		if (freeze_mode) {
			temp_group.destroy();
			layer.draw();
			freeze_mode = false;
		}
	}

	paint_btn.onclick = function() {
		paint_mode = true;
		drag_mode = false;
		erase_mode = false;

		var layers = stage.getChildren();
		var groups = layers[0].getChildren();
		var images = groups[0].getChildren();

		for(i=0; i<images.length; i++) {
			images[i].setDraggable(false);
		}
	};

	drag_btn.onclick = function() {
		paint_mode = false;
		drag_mode = true;
		erase_mode = false;

		var layers = stage.getChildren();
		var groups = layers[0].getChildren();
		var objects = groups[0].getChildren();

		for(i=0; i<objects.length; i++) {
			if (objects[i] instanceof Kinetic.Group) {
				objects[i].setDraggable(true);
			}
		}
	};

	erase_btn.onclick = function() {
		erase_mode = true;
		paint_mode = false;
		drag_mode = false;
	}

	clear_canvas.onclick = function() {
		layer.destroy();
		stage.clear();
		init_variable();
		init();
		activities = [];
	};

	save_canvas.onclick = function() {
		stage.toDataURL({
			callback:function(data_uri) {
				window.open(data_uri);
				/**
				 * 1. Send data_uri to server
				 * 2. Server save the data into file as .png
				 * 3. Give callback
				 */
			},
			mimeType:'image/png',
			quality:0.5
		});

		return false;
	};

	record_canvas.onclick = function() {
		memcard = JSON.stringify(activities);
	}

	load_canvas.onclick = function() {
		if (memcard != undefined) {
			activities = JSON.parse(memcard);
			clear_canvas.onclick();

			for(i=0; i<activities.length; i++) {
				var activity = activities[i];

				if (activity.activity == "paint" || activity.activity == "erase") {
					var line = new Kinetic.Line({
						points:activity.points,
						stroke:activity.color,
						strokeWidth: activity.width,
						lineCap: 'round',
						lineJoin: 'round'
					});

					var layers = stage.getChildren();
					var groups = layers[0].getChildren();
					groups[0].add(line);
				}
			}

			layer.draw();
		}
	}

	sockjs.onopen = function() {
		console.log("SockJS connected!");
	}

	sockjs.onmessage = function(e) {
		var obj = JSON.parse(e.data);
		var message = JSON.parse(obj.text);
		var layers = stage.getChildren();
		var groups = layers[0].getChildren();
		var children = groups[0].getChildren();
		var found = false;
		var idx = 0;

		while (!found && idx < children.length) {
			if (children[idx].getName() == message.name) {
				found = true;
			} else {
				idx++;
			}
		}

		if (!found) {
			draw_points = [message.x, message.y];
			var line = new Kinetic.Line({
				points:draw_points,
				stroke: 'red',
				strokeWidth: 5,
				lineCap: 'round',
				lineJoin: 'round',
				name:message.name
			});

			groups[0].add(line);
		} else {
			var line = children[idx];
			draw_points.push(message.x);
			draw_points.push(message.y);
			line.setPoints(draw_points);
			stage.draw();
		}
	}
});
