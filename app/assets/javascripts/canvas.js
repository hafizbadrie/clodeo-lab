var url = "http://localhost:3001/sock";
var domain = "http://localhost:3000";
var sockjs = new SockJS(url);
var connid = "";

$(function() {
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
	var send_message= document.getElementById("send-message");
	var set_pos = document.getElementById("set-image-pos");
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
	var line_stack_pos = -1;

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

	function draw_image(image_obj, group_name) {
		var layers = stage.getChildren();
		var groups = layers[0].getChildren();
		var child_group = new Kinetic.Group({
			draggable:drag_mode,
			name:group_name
		})
		groups[0].add(child_group);

		var image = new Kinetic.Image({
			image: image_obj,
			x: 10,
			y: 10,
			name:'image'
		});

		child_group.add(image);

		add_anchor(child_group, 10, 10, 'top_left');
		add_anchor(child_group, image_obj.width+10, 10, 'top_right');
		add_anchor(child_group, 10, image_obj.height+10, 'bottom_left');
		add_anchor(child_group, image_obj.width+10, image_obj.height+10, 'bottom_right');

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

		child_group.on('dragend', function() {
			var points = this.getPosition();
			sockjs.send(JSON.stringify({name:this.getName(), x:points.x, y:points.y, type:"drag"}));
		})

		img_idx++;

		stage.draw();

		images.push(image);
	};

	init_variable();
	init();

	var paint_start = function(e) {
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
					line_name = "line_" + connid + "_" + Date.now();
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
				var group_children = groups[0].getChildren();
				line_stack_pos = group_children.length - 1;

				/* save activity */
				points.push({x:e.pageX-left_offset, y:e.pageY-50});
				sockjs.send(JSON.stringify({name:line_name, x:e.pageX-left_offset, y:e.pageY-50, type:"paint"}));
			}
		}
	}

	var painting = function(e) {
		var elm = e.target;
		if (elm.nodeName == "CANVAS") {
			if (is_painting && (paint_mode || erase_mode)) {
				left_offset = document.getElementsByClassName('container')[0].offsetLeft;
				draw_points.push(e.pageX-left_offset);
				draw_points.push(e.pageY-50);

				var layers = stage.getChildren();
				var groups = layers[0].getChildren();
				var red_lines = groups[0].getChildren();
				red_lines[line_stack_pos].setPoints(draw_points);
				stage.draw();

				/* save activity */
				points.push({x:e.pageX-left_offset, y:e.pageY-50});
				sockjs.send(JSON.stringify({name:line_name, x:e.pageX-left_offset, y:e.pageY-50, type:"paint"}));
			}
		}
	}

	var paint_stop = function(e) {
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
				line_stack_pos = -1;
			}
		}
	}

	document.ontouchstart = function(e) {
		paint_start(e);
	};
	document.onmousedown = function(e) {
		paint_start(e);
	};
	document.ontouchmove = function(e) {
		painting(e);
	}
	document.onmousemove = function(e) {
		painting(e);
	}
	document.ontouchend = function(e) {
		paint_stop(e);		
	}
	document.onmouseup = function(e) {
		paint_stop(e);
	}

	$("#fileuploader").fileupload({
		url:'/canvas/upload',
		dataType:'json',
		done:function(e, data) {
			var response = data.result
			if (response.status == "success") {
				var image_obj = new Image();
				var image_path = domain + response.filepath;
				var group_name = "group_" + connid + "_" + Date.now();
				image_obj.src = image_path;

				image_obj.onload = function() {
					draw_image(this, group_name);
					sockjs.send(JSON.stringify({name:group_name, path:image_path, type:"image"}));
				}
			} else {
				// show alert with bootstrap
			}
		},
		progressall:function(e,data) {

		}
	});

	remove_image.onclick = function() {
		if (freeze_mode) {
			temp_group.destroy();
			sockjs.send(JSON.stringify({name:temp_group.getName(), type:"image_remove"}));
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
		sockjs.send(JSON.stringify({type:"clear"}));
		layer.destroy();
		stage.clear();
		init_variable();
		init();
		activities = [];
	};

	save_canvas.onclick = function() {
		stage.toDataURL({
			callback:function(data_uri) {
				$.ajax({
					type:"POST",
					url:"/canvas/base64image",
					dataType:"json",
					data:{
						uri_data:data_uri
					},
					success:function(response) {
						if (response.status == "success") {
							var form = document.createElement("form");
							var field = document.createElement("input");
							form.setAttribute("method", "post");
							form.setAttribute("action", "/canvas/getimage");
							field.setAttribute("type", "hidden");
							field.setAttribute("name", "filename");
							field.setAttribute("value", response.filename);
							form.appendChild(field);
							document.body.appendChild(form);
							form.submit();
						} else {
							alert("Oops! There's something wrong with our system.")
						}
					}
				});
			},
			mimeType:'image/png',
			quality:0.5
		});

		return false;
	};

	var print_message = function(fullname, message) {
		var row_div = document.createElement("div");
		var span7_div = document.createElement("div");
		var space_div = document.createElement("div");
		row_div.setAttribute("class", "row");
		span7_div.setAttribute("class", "span7 chatbox");
		span7_div.innerHTML = "<strong>" + fullname + ":</strong> " + message;
		row_div.appendChild(span7_div);
		space_div.setAttribute("class", "space");
		document.getElementById("message-board").appendChild(row_div);
		document.getElementById("message-board").appendChild(space_div);

		document.getElementById("chat-message").value = "";
	}

	send_message.onclick = function() {
		var fullname = document.getElementById("chat-username").value;
		var message = document.getElementById("chat-message").value;
		
		if (message != "") {
			if (fullname == "") {
				fullname = "Anonymous";
			}

			print_message(fullname, message);
			sockjs.send(JSON.stringify({fullname:fullname, message:message, type:"chat"}));
		}
	}

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

	sockjs.onopen = function(e) {
		
	}

	sockjs.onmessage = function(e) {
		var obj = JSON.parse(e.data);

		if (obj.status == "connect") {
			connid = obj.id;
		} else if (obj.status == "data") {
			var message = JSON.parse(obj.text);

			if (message.type == "paint") {
				var layers = stage.getChildren();
				var groups = layers[0].getChildren();
				var children = groups[0].getChildren();
				var found = false;
				var idx = 0;
				var people_points = [];

				while (!found && idx < children.length) {
					if (children[idx].getName() == message.name) {
						found = true;
					} else {
						idx++;
					}
				}

				if (!found) {
					people_points = [message.x, message.y];
					var line = new Kinetic.Line({
						points:people_points,
						stroke: 'red',
						strokeWidth: 5,
						lineCap: 'round',
						lineJoin: 'round',
						name:message.name
					});

					groups[0].add(line);
				} else {
					var line = children[idx];
					people_points = line.getPoints();
					people_points.push({x:message.x, y:message.y});
					line.setPoints(people_points);
					stage.draw();
				}
			} else if (message.type == "image") {
				var image_obj = new Image();
				image_obj.src = message.path;

				image_obj.onload = function() {
					draw_image(this, message.name);
				}
			} else if (message.type == "image_remove") {
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

				var group = children[idx];
				group.destroy();
				stage.draw();
			} else if (message.type == "chat") {
				var fullname = message.fullname;
				var message = message.message;

				print_message(fullname, message);
			} else if (message.type == "drag") {
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

				var group = children[idx];
				group.setPosition(message.x, message.y);
				stage.draw();
			} else if (message.type == "clear") {
				layer.destroy();
				stage.clear();
				init_variable();
				init();
				activities = [];
			}
		}
	}
});
