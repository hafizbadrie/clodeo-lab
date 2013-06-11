var url = '/sock';
var sockjs = new SockJS(url);

var form = $('#form');
var input = $('#input');
var content = $('#content');
var info = $('#info');

input.addClass('uneditable-input');
input.prop('disabled', true);

form.submit(function(){
	sockjs.send(input.val());
	input.val("");

	return false;
})

sockjs.onopen = function(){
	info.text('open');
	input.removeClass('uneditable-input');
	input.prop('disabled', false);
	info.addClass('label-info');
}

sockjs.onmessage = function(e){
	var obj = JSON.parse(e.data);
	content.append("<p>" + obj.text + ' <span class="label label-info">' + obj.id.substr(0,5) + ' ...' +  '</span></p>');
};

sockjs.onclose = function(){
	info.text('closed');
	input.addClass('uneditable-input');
	input.prop('disabled', true);
	info.removeClass('label-info');
}

