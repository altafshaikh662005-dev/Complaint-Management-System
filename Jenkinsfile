pipeline {
    agent any

    options {
        disableConcurrentBuilds()
    }

    environment {
        APP_VERSION = '0.1.1'
        DOCKER_CONFIG = "${WORKSPACE}/.docker-ci-config-${BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Backend Install') {
            steps {
                dir('server') {
                    bat 'npm ci'
                }
            }
        }

        stage('Backend Tests') {
            steps {
                dir('server') {
                    withCredentials([string(
                        credentialsId: 'complaint-jwt-secret',
                        variable: 'JWT_SECRET'
                    )]) {
                        bat 'npm test'
                    }
                }
            }
        }

        stage('Frontend Install') {
            steps {
                dir('client') {
                    bat 'npm ci'
                }
            }
        }

        stage('Frontend Build') {
            steps {
                dir('client') {
                    bat 'npm run build'
                }
            }
        }

        stage('Docker Build') {
            steps {
                bat '''
@echo off
docker build --tag complaint-management-backend:%APP_VERSION% --file server/Dockerfile server
if errorlevel 1 exit /b 1
docker build --build-arg VITE_API_URL=/api --tag complaint-management-frontend:%APP_VERSION% --file client/Dockerfile client
if errorlevel 1 exit /b 1
'''
            }
        }

        stage('Docker Login') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKERHUB_USERNAME',
                    passwordVariable: 'DOCKERHUB_TOKEN'
                )]) {
                    bat '''
@echo off
powershell.exe -NoLogo -NoProfile -NonInteractive -Command "$env:DOCKERHUB_TOKEN | docker login --username $env:DOCKERHUB_USERNAME --password-stdin"
'''
                }
            }
        }

        stage('Docker Push') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKERHUB_USERNAME',
                    passwordVariable: 'DOCKERHUB_TOKEN'
                )]) {
                    bat '''
@echo off
set "BACKEND_IMAGE=%DOCKERHUB_USERNAME%/complaint-management-backend:%APP_VERSION%"
set "FRONTEND_IMAGE=%DOCKERHUB_USERNAME%/complaint-management-frontend:%APP_VERSION%"
set "MANIFEST_ERROR=%TEMP%\\jenkins-manifest-%RANDOM%.txt"

docker manifest inspect "%BACKEND_IMAGE%" >NUL 2>"%MANIFEST_ERROR%"
if not errorlevel 1 (
    echo ERROR: %BACKEND_IMAGE% already exists. Bump APP_VERSION to publish a new release.
    del "%MANIFEST_ERROR%" >NUL 2>&1
    exit /b 1
)

findstr /I /C:"no such manifest" /C:"manifest unknown" "%MANIFEST_ERROR%" >NUL
if errorlevel 1 (
    type "%MANIFEST_ERROR%"
    echo ERROR: Could not confirm that %BACKEND_IMAGE% is absent. Refusing to push.
    del "%MANIFEST_ERROR%" >NUL 2>&1
    exit /b 1
)

docker manifest inspect "%FRONTEND_IMAGE%" >NUL 2>"%MANIFEST_ERROR%"
if not errorlevel 1 (
    echo ERROR: %FRONTEND_IMAGE% already exists. Bump APP_VERSION to publish a new release.
    del "%MANIFEST_ERROR%" >NUL 2>&1
    exit /b 1
)

findstr /I /C:"no such manifest" /C:"manifest unknown" "%MANIFEST_ERROR%" >NUL
if errorlevel 1 (
    type "%MANIFEST_ERROR%"
    echo ERROR: Could not confirm that %FRONTEND_IMAGE% is absent. Refusing to push.
    del "%MANIFEST_ERROR%" >NUL 2>&1
    exit /b 1
)

del "%MANIFEST_ERROR%" >NUL 2>&1

docker tag complaint-management-backend:%APP_VERSION% "%BACKEND_IMAGE%"
if errorlevel 1 exit /b 1

docker tag complaint-management-frontend:%APP_VERSION% "%FRONTEND_IMAGE%"
if errorlevel 1 exit /b 1

docker push "%BACKEND_IMAGE%"
if errorlevel 1 exit /b 1

docker push "%FRONTEND_IMAGE%"
'''
                }
            }
        }
    }

    post {
        always {
            bat '''
@echo off
if exist "%DOCKER_CONFIG%" rmdir /s /q "%DOCKER_CONFIG%"
'''
        }
    }
}