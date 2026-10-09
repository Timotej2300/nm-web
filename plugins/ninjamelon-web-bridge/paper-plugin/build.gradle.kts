dependencies {
    implementation(project(":bridge-common"))
    compileOnly("io.papermc.paper:paper-api:${property("paperApiVersion")}")
    compileOnly("net.luckperms:api:${property("luckPermsApiVersion")}")
    compileOnly("com.google.code.gson:gson:${property("gsonVersion")}")
}

val commonJar = project(":bridge-common").tasks.named<Jar>("jar")
tasks.named<Jar>("jar") {
    dependsOn(commonJar)
    from({ zipTree(commonJar.get().archiveFile.get().asFile) })
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
}