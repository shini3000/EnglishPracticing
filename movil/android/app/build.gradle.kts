import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.util.Properties
import java.net.URI

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val mobileConfig = Properties().apply {
    val config = rootProject.file("mobile.properties")
    if (config.exists()) config.inputStream().use { load(it) }
}
fun clientSetting(name: String, fallback: String = "") =
    providers.gradleProperty(name).orNull ?: mobileConfig.getProperty(name) ?: System.getenv(name) ?: fallback
val apiBaseUrl = clientSetting("API_BASE_URL").trimEnd('/')
val clerkKey = clientSetting("CLERK_PUBLISHABLE_KEY")
require(apiBaseUrl.isBlank() || runCatching {
    val url = URI(apiBaseUrl)
    url.scheme == "https" && !url.host.isNullOrBlank() && url.userInfo == null && url.query == null && url.fragment == null && url.path.isNullOrEmpty()
}.getOrDefault(false)) { "API_BASE_URL must be an HTTPS origin without credentials or query parameters" }
require(clerkKey.isBlank() || clerkKey.startsWith("pk_test_") || clerkKey.startsWith("pk_live_")) {
    "Android accepts only a Clerk publishable key"
}
fun quoted(value: String) = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

android {
    namespace = "com.englishpracticing.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.englishpracticing.android"
        minSdk = 26
        targetSdk = 36
        versionCode = 5
        versionName = "0.5.0"
        buildConfigField("String", "API_BASE_URL", quoted(apiBaseUrl))
        buildConfigField("String", "CLERK_PUBLISHABLE_KEY", quoted(clerkKey))
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { compose = true; buildConfig = true }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2026.06.01"))
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.10.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
    implementation("com.clerk:clerk-android-api:1.2.1")
    implementation("com.clerk:clerk-android-ui:1.2.1")
    implementation("io.livekit:livekit-android:2.29.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
}
