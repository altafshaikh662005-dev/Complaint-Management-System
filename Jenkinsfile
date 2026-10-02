pipeline {
    agent any

    parameters {
        string(
            name: 'ROLLBACK_TO_VERSION',
            defaultValue: '',
            description: 'Set to an existing Docker Hub version such as 0.1.14 to roll back.'
        )
    }

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
            when {
                expression { (params.ROLLBACK_TO_VERSION ?: '').trim() == '' }
            }
            steps {
                dir('server') {
                    bat 'npm ci'
                }
            }
        }

        stage('MongoDB Test Service') {
            when {
                expression { (params.ROLLBACK_TO_VERSION ?: '').trim() == '' }
            }
            steps {
                bat '''
@echo off

docker run --detach --name complaint-test-mongodb-%BUILD_NUMBER% --publish 127.0.0.1::27017 --tmpfs /data/db mongo:7.0
if errorlevel 1 exit /b 1

powershell.exe -NoLogo -NoProfile -NonInteractive -Command "$deadline = (Get-Date).AddMinutes(2); while ((Get-Date) -lt $deadline) { docker exec complaint-test-mongodb-%BUILD_NUMBER% mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' > $null 2>&1; if ($LASTEXITCODE -eq 0) { exit 0 }; Start-Sleep -Seconds 2 }; exit 1"
if errorlevel 1 exit /b 1
'''
            }
        }

        stage('Backend Tests') {
            when {
                expression { (params.ROLLBACK_TO_VERSION ?: '').trim() == '' }
            }
            steps {
                dir('server') {
                    withCredentials([string(
                        credentialsId: 'complaint-jwt-secret',
                        variable: 'JWT_SECRET'
                    )]) {
                        bat '''
@echo off

set "MONGO_PORT="
for /f "tokens=2 delims=:" %%P in ('docker port complaint-test-mongodb-%BUILD_NUMBER% 27017/tcp') do set "MONGO_PORT=%%P"
if not defined MONGO_PORT exit /b 1

set "MONGO_URI=mongodb://127.0.0.1:%MONGO_PORT%/complaint-management-system-test"
npm run test:ci
'''
                    }
                }
            }
        }

        stage('Frontend Install') {
            when {
                expression { (params.ROLLBACK_TO_VERSION ?: '').trim() == '' }
            }
            steps {
                dir('client') {
                    bat 'npm ci'
                }
            }
        }

        stage('Frontend Build') {
            when {
                expression { (params.ROLLBACK_TO_VERSION ?: '').trim() == '' }
            }
            steps {
                dir('client') {
                    bat 'npm run build'
                }
            }
        }

        stage('Docker Build') {
            when {
                expression { (params.ROLLBACK_TO_VERSION ?: '').trim() == '' }
            }
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

        stage('Trivy Scan') {
            when {
                expression { (params.ROLLBACK_TO_VERSION ?: '').trim() == '' }
            }
            steps {
                bat '''
@echo off

docker save --output "trivy-backend-%APP_VERSION%.tar" complaint-management-backend:%APP_VERSION%
if errorlevel 1 exit /b 1

docker save --output "trivy-frontend-%APP_VERSION%.tar" complaint-management-frontend:%APP_VERSION%
if errorlevel 1 exit /b 1

echo ========================================
echo Trivy Vulnerability Scan
echo Version: %APP_VERSION%
echo Findings are reported without blocking this vulnerable baseline.
echo ========================================

docker run --rm --volume "%WORKSPACE%:/scan" --volume trivy-cache:/root/.cache aquasec/trivy:0.75.0 image --input "/scan/trivy-backend-%APP_VERSION%.tar" --scanners vuln --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL --no-progress --exit-code 0
if errorlevel 1 exit /b 1

docker run --rm --volume "%WORKSPACE%:/scan" --volume trivy-cache:/root/.cache aquasec/trivy:0.75.0 image --input "/scan/trivy-frontend-%APP_VERSION%.tar" --scanners vuln --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL --no-progress --exit-code 0
if errorlevel 1 exit /b 1
'''
            }
        }

        stage('Docker Login') {
            when {
                expression { (params.ROLLBACK_TO_VERSION ?: '').trim() == '' }
            }
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
            when {
                expression { (params.ROLLBACK_TO_VERSION ?: '').trim() == '' }
            }
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

        stage('Kubernetes Deploy') {
            when {
                expression { (params.ROLLBACK_TO_VERSION ?: '').trim() == '' }
            }
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-credentials',
                        usernameVariable: 'DOCKERHUB_USERNAME',
                        passwordVariable: 'DOCKERHUB_TOKEN'
                    ),
                    file(
                        credentialsId: 'complaint-kubeconfig',
                        variable: 'KUBECONFIG'
                    )
                ]) {
                    script {
                        def backendUpdated = false
                        def frontendUpdated = false

                        try {
                            bat '''
@echo off
set "BACKEND_IMAGE=%DOCKERHUB_USERNAME%/complaint-management-backend:%APP_VERSION%"
kubectl set image deployment/complaint-backend backend="%BACKEND_IMAGE%"
if errorlevel 1 exit /b 1
'''
                            backendUpdated = true
                            bat 'kubectl rollout status deployment/complaint-backend --timeout=180s'

                            bat '''
@echo off
set "FRONTEND_IMAGE=%DOCKERHUB_USERNAME%/complaint-management-frontend:%APP_VERSION%"
kubectl set image deployment/complaint-frontend frontend="%FRONTEND_IMAGE%"
if errorlevel 1 exit /b 1
'''
                            frontendUpdated = true
                            bat 'kubectl rollout status deployment/complaint-frontend --timeout=180s'
                        } catch (failure) {
                            echo 'Deployment failed; rolling back workloads that were updated.'
                            if (frontendUpdated) {
                                bat 'kubectl rollout undo deployment/complaint-frontend'
                                bat 'kubectl rollout status deployment/complaint-frontend --timeout=180s'
                            }
                            if (backendUpdated) {
                                bat 'kubectl rollout undo deployment/complaint-backend'
                                bat 'kubectl rollout status deployment/complaint-backend --timeout=180s'
                            }
                            throw failure
                        }
                    }
                }
            }
        }

        stage('Kubernetes Rollback') {
            when {
                expression { (params.ROLLBACK_TO_VERSION ?: '').trim() != '' }
            }
            steps {
                script {
                    def rollbackVersion = (params.ROLLBACK_TO_VERSION ?: '').trim()
                    if (!(rollbackVersion ==~ /\d+\.\d+\.\d+/)) {
                        error('ROLLBACK_TO_VERSION must be a Docker Hub version in major.minor.patch format.')
                    }

                    withCredentials([
                        usernamePassword(
                            credentialsId: 'dockerhub-credentials',
                            usernameVariable: 'DOCKERHUB_USERNAME',
                            passwordVariable: 'DOCKERHUB_TOKEN'
                        ),
                        file(
                            credentialsId: 'complaint-kubeconfig',
                            variable: 'KUBECONFIG'
                        )
                    ]) {
                        bat '''
@echo off
powershell.exe -NoLogo -NoProfile -NonInteractive -Command "$env:DOCKERHUB_TOKEN | docker login --username $env:DOCKERHUB_USERNAME --password-stdin"
if errorlevel 1 exit /b 1
'''
                        withEnv(["ROLLBACK_VERSION=${rollbackVersion}"]) {
                            bat '''
@echo off
set "BACKEND_IMAGE=%DOCKERHUB_USERNAME%/complaint-management-backend:%ROLLBACK_VERSION%"
set "FRONTEND_IMAGE=%DOCKERHUB_USERNAME%/complaint-management-frontend:%ROLLBACK_VERSION%"

docker manifest inspect "%BACKEND_IMAGE%" >NUL 2>&1
if errorlevel 1 (
    echo ERROR: Backend image %BACKEND_IMAGE% is not available in Docker Hub.
    exit /b 1
)

docker manifest inspect "%FRONTEND_IMAGE%" >NUL 2>&1
if errorlevel 1 (
    echo ERROR: Frontend image %FRONTEND_IMAGE% is not available in Docker Hub.
    exit /b 1
)

kubectl set image deployment/complaint-backend backend="%BACKEND_IMAGE%"
if errorlevel 1 exit /b 1
kubectl rollout status deployment/complaint-backend --timeout=180s
if errorlevel 1 exit /b 1

kubectl set image deployment/complaint-frontend frontend="%FRONTEND_IMAGE%"
if errorlevel 1 exit /b 1
kubectl rollout status deployment/complaint-frontend --timeout=180s
if errorlevel 1 exit /b 1
'''
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            bat '''
@echo off

docker rm --force complaint-test-mongodb-%BUILD_NUMBER% >NUL 2>&1

if exist "%WORKSPACE%\\trivy-backend-%APP_VERSION%.tar" del "%WORKSPACE%\\trivy-backend-%APP_VERSION%.tar" >NUL 2>&1
if exist "%WORKSPACE%\\trivy-frontend-%APP_VERSION%.tar" del "%WORKSPACE%\\trivy-frontend-%APP_VERSION%.tar" >NUL 2>&1

if exist "%DOCKER_CONFIG%" (
    rmdir /s /q "%DOCKER_CONFIG%"
)

exit /b 0
'''
        }
    }
}