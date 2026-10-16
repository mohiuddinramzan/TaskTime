// AGP 8.5.2 requires Gradle >= 8.7 and JDK 17. CI uses Gradle 8.9 + Temurin 17.
plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}
