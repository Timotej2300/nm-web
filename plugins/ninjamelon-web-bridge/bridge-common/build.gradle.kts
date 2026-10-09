dependencies {
    compileOnly("com.google.code.gson:gson:${property("gsonVersion")}")
    testImplementation("org.junit.jupiter:junit-jupiter:5.12.1")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher:1.12.1")
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
}