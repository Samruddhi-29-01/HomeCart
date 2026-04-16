pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  environment {
    NODE_ENV = 'production'
    DOCKER_IMAGE = 'homekart'
    DOCKER_PUSH = 'false'
    // Optional: set these in Jenkins job/global env if you want registry push.
    // DOCKER_REGISTRY_CREDENTIALS = 'docker-registry-credentials-id'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Clean Up Old Images') {
      steps {
        script {
          echo 'Cleaning up old Docker images...'
          if (isUnix()) {
            sh '''
              docker rmi -f $(docker images "${DOCKER_IMAGE}" --quiet) || true
              docker system prune -f || true
            '''
          } else {
            bat '''
              for /F "tokens=*" %%i in ('docker images "%DOCKER_IMAGE%" --quiet') do docker rmi -f %%i
              docker system prune -f || exit /b 0
            '''
          }
        }
      }
    }

    stage('Build Docker Image') {
      steps {
        script {
          def imageTag = "${env.DOCKER_IMAGE}:${env.BUILD_NUMBER}"
          def latestTag = "${env.DOCKER_IMAGE}:latest"

          echo "Building Docker image: ${imageTag} and ${latestTag}..."
          if (isUnix()) {
            sh "docker build -t ${imageTag} -t ${latestTag} ."
          } else {
            bat "docker build -t ${imageTag} -t ${latestTag} ."
          }
          
          echo "Docker image built successfully!"
        }
      }
    }

    stage('Docker Compose Smoke Test') {
      when {
        expression { return fileExists('docker-compose.yml') }
      }
      steps {
        script {
          if (isUnix()) {
            sh '''
              docker compose -f docker-compose.yml up -d --build
              for i in $(seq 1 30); do
                if curl -fsS http://localhost:5001/ > /dev/null; then
                  echo "Containerized app is reachable."
                  exit 0
                fi
                sleep 5
              done
              echo "App did not become healthy in time. Dumping compose logs..."
              docker compose -f docker-compose.yml logs
              exit 1
            '''
          } else {
            bat '''
              docker compose -f docker-compose.yml up -d --build
              powershell -NoProfile -Command "$ok=$false; 1..30 | ForEach-Object { try { Invoke-WebRequest -UseBasicParsing http://localhost:5001/ -TimeoutSec 5 | Out-Null; $ok=$true; break } catch { Start-Sleep -Seconds 5 } }; if(-not $ok){ Write-Host 'App did not become healthy in time.'; exit 1 }"
            '''
          }
        }
      }
    }

    stage('Push Docker Image (optional)') {
      when {
        allOf {
          expression { return env.DOCKER_IMAGE?.trim() }
          expression { return env.DOCKER_PUSH == 'true' }
          expression { return env.DOCKER_REGISTRY_CREDENTIALS?.trim() }
        }
      }
      steps {
        script {
          docker.withRegistry('', env.DOCKER_REGISTRY_CREDENTIALS) {
            def builtImage = docker.image("${env.DOCKER_IMAGE}:${env.BUILD_NUMBER}")
            builtImage.push()
            builtImage.push('latest')
          }
        }
      }
    }
  }

  post {
    always {
      script {
        if (fileExists('docker-compose.yml')) {
          if (isUnix()) {
            sh 'docker compose -f docker-compose.yml down -v || true'
          } else {
            bat 'docker compose -f docker-compose.yml down -v'
          }
        }
      }
      cleanWs()
    }
    success {
      echo 'Pipeline completed successfully.'
    }
    failure {
      echo 'Pipeline failed. Check stage logs for details.'
    }
  }
}
