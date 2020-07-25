import os

# Application definition
INSTALLED_APPS = [
    "corsheaders",
    'whitenoise.runserver_nostatic',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'api.apps.ApiConfig',
    'frontend.apps.FrontendConfig',
    'rest_framework',
    'webpack_loader',
    'huey.contrib.djhuey',
]


SECRET_KEY = 'default'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ['0.0.0.0', '127.0.0.1', 'localhost', "172.26.12.246", "*"]

# DEFAULT_FILE_STORAGE = 'storages.backends.azure_storage.AzureStorage'
# OR
DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Database
# https://docs.djangoproject.com/en/3.0/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': 'spleeter-web.sqlite3',
    }
}

REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ]
}

HUEY = {
    'huey_class': 'huey.SqliteHuey',
    'results': False,
    'immediate': False,
    'consumer': {
        'workers': int(os.getenv('HUEY_WORKERS', '1')),
    },
}

MIDDLEWARE_CLASSES = [                                                
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',              
]

MIDDLEWARE = [                                                
    'api.cors_middleware.CustomCorsMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',              
    'django.middleware.security.SecurityMiddleware',          
    'whitenoise.middleware.WhiteNoiseMiddleware',             
    'django.contrib.sessions.middleware.SessionMiddleware',   
    'django.middleware.csrf.CsrfViewMiddleware',              
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',   
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]                                                             



CORS_ORIGIN_ALLOW_ALL = True
