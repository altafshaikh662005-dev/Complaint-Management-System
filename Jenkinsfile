pipeline {
    agent any

    options {
        disableConcurrentBuilds()
    }

    environment {
        // Automatically creates a unique version for every Jenkins build.
        // Example: build #11 -> 0.1.11
        APP_VERSION = "0.1.${BUILD_NUMBER}"

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

echo ========================================
echo Docker Build
echo Version: %APP_VERSION%
echo ========================================

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

echo ========================================
echo Docker Hub Login
echo ========================================

powershell.exe -NoLogo -NoProfile -NonInteractive -Command "$env:DOCKERHUB_TOKEN | docker login --username $env:DOCKERHUB_USERNAME --password-stdin"

if errorlevel 1 exit /b 1
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

echo ========================================
echo Docker Push
echo Version: %APP_VERSION%
echo ========================================

set "BACKEND_IMAGE=%DOCKERHUB_USERNAME%/complaint-management-backend:%APP_VERSION%"
set "FRONTEND_IMAGE=%DOCKERHUB_USERNAME%/complaint-management-frontend:%APP_VERSION%"
set "MANIFEST_ERROR=%TEMP%\\jenkins-manifest-%RANDOM%.txt"

echo.
echo Checking backend image:
echo %BACKEND_IMAGE%

docker manifest inspect "%BACKEND_IMAGE%" >NUL 2>"%MANIFEST_ERROR%"

if not errorlevel 1 (
    echo ERROR: %BACKEND_IMAGE% already exists.
    echo This should not normally happen because APP_VERSION uses BUILD_NUMBER.
    del "%MANIFEST_ERROR%" >NUL 2>&1
    exit /b 1
)

findstr /I /C:"no such manifest" /C:"manifest unknown" "%MANIFEST_ERROR%" >NUL

if errorlevel 1 (
    type "%MANIFEST_ERROR%"
    echo ERROR: Could not confirm that %BACKEND_IMAGE% is absent.
    echo Refusing to push.
    del "%MANIFEST_ERROR%" >NUL 2>&1
    exit /b 1
)

echo Backend tag is available.

echo.
echo Checking frontend image:
echo %FRONTEND_IMAGE%

docker manifest inspect "%FRONTEND_IMAGE%" >NUL 2>"%MANIFEST_ERROR%"

if not errorlevel 1 (
    echo ERROR: %FRONTEND_IMAGE% already exists.
    echo This should not normally happen because APP_VERSION uses BUILD_NUMBER.
    del "%MANIFEST_ERROR%" >NUL 2>&1
    exit /b 1
)

findstr /I /C:"no such manifest" /C:"manifest unknown" "%MANIFEST_ERROR%" >NUL

if errorlevel 1 (
    type "%MANIFEST_ERROR%"
    echo ERROR: Could not confirm that %FRONTEND_IMAGE% is absent.
    echo Refusing to push.
    del "%MANIFEST_ERROR%" >NUL 2>&1
    exit /b 1
)

echo Frontend tag is available.

del "%MANIFEST_ERROR%" >NUL 2>&1

echo.
echo Tagging backend image...
docker tag complaint-management-backend:%APP_VERSION% "%BACKEND_IMAGE%"
if errorlevel 1 exit /b 1

echo Tagging frontend image...
docker tag complaint-management-frontend:%APP_VERSION% "%FRONTEND_IMAGE%"
if errorlevel 1 exit /b 1

echo.
echo Pushing backend:
echo %BACKEND_IMAGE%
docker push "%BACKEND_IMAGE%"
if errorlevel 1 exit /b 1

echo.
echo Pushing frontend:
echo %FRONTEND_IMAGE%
docker push "%FRONTEND_IMAGE%"
if errorlevel 1 exit /b 1

echo.
echo ========================================
echo Docker Push Completed Successfully
echo Version: %APP_VERSION%
echo ========================================
'''
                }
            }
        }
    }

    post {
        always {
            bat '''
@echo off

if exist "%DOCKER_CONFIG%" (
    rmdir /s /q "%DOCKER_CONFIG%"
)
'''
        }
    }
}