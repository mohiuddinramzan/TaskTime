plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The web app lives in the repository root (index.html, css/, js/, manifest.json). It is copied into the APK's
// assets at build time under assets/www/, so the UI never depends on a remote website.
val repoRoot = rootProject.projectDir.parentFile
val syncWebAssets by tasks.registering(Sync::class) {
    from(repoRoot) {
        include("index.html", "manifest.json", "css/**", "js/**")
    }
    into(layout.buildDirectory.dir("generated/webAssets/www"))
}

android {
    namespace = "com.tasktime.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.tasktime.app"
        minSdk = 26 // adaptive launcher icon without PNG fallbacks; ~95% of active devices
        targetSdk = 34
        versionCode = (project.findProperty("ttVersionCode") as String?)?.toIntOrNull() ?: 2
        versionName = (project.findProperty("ttVersionName") as String?) ?: "2.0.0"
    }

    // Release signing is OPTIONAL and driven only by environment variables (never committed).
    val keystorePath = System.getenv("TT_KEYSTORE_PATH")
    signingConfigs {
        if (keystorePath != null) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = System.getenv("TT_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("TT_KEY_ALIAS")
                keyPassword = System.getenv("TT_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            // Debug APK needs NO signing secrets (uses the auto-generated debug keystore).
            isDebuggable = true
        }
        release {
            isMinifyEnabled = false
            if (keystorePath != null) signingConfig = signingConfigs.getByName("release")
        }
    }

    sourceSets.getByName("main") {
        assets.srcDir(layout.buildDirectory.dir("generated/webAssets"))
    }

    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    testOptions { unitTests.isReturnDefaultValues = true }
}

// Make every task that reads assets (merge*, lint*, package*) wait for the web copy.
tasks.configureEach {
    if (name != "syncWebAssets" && (name.endsWith("Assets") || name.startsWith("lint") || name.startsWith("package"))) {
        dependsOn(syncWebAssets)
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.11.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303") // real org.json for JVM unit tests (android.jar's is stubbed)
}
