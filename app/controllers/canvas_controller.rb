class CanvasController < ApplicationController
  def index
  end

  def base64image
  	uri_data = params[:uri_data]
  	temp_uri = uri_data.split(",")
  	meta_data = temp_uri[0].split(";")
  	base64_code = temp_uri[1]
  	image_type = meta_data[0][5..meta_data[0].length-1]
  	is_fail = false
  	status = "success"
  	extension = ""

  	if image_type == "image/png"
  		filename = Digest::MD5.hexdigest(Time.now.to_s)
  		extension = ".png"
  	else
  		is_fail = true
  		status = "fail"
  	end

  	unless is_fail
	  	File.open(Rails.root.join('public', 'canvas', filename + extension), 'wb') do |f|
	  		f.write(Base64.decode64(base64_code))
	  	end
		end

  	retval = Hash.new
  	retval[:status] = status

    unless is_fail
      retval[:filename] = filename+extension
    end
  	
  	render json: retval
  end

  def getimage
    filename = params[:filename]
    send_file Rails.root.join('public', 'canvas', filename), type: "image/png", filename: filename
  end
end
