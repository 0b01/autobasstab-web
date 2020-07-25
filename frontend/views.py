from django.shortcuts import render

def index(request):
    resp = render(request, 'index.html')
    # resp["Access-Control-Allow-Origin"] = "http://rickyhan.com"
    return resp
