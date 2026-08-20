/* 
========================================================================
FILE OVERVIEW: BACKEND ENGINE & SERVER ENTRY POINT
========================================================================
PURPOSE: 
This file is the ignition switch for the entire enterprise application. 
It launches the Java Spring Boot framework, automatically spins up an 
embedded web server (Apache Tomcat), and readies the application to 
handle incoming web traffic.

HOW IT INTERACTS WITH THE ARCHITECTURE:
This file is the core of the "Server" side. 
1. When you run this file, it brings the backend online (typically on port 8080).
2. It automatically acts as a radar, scanning your project folders for any 
   REST API controllers, database models, or security configurations you build later, 
   and wires them all together automatically.
3. When a user visits your app's URL, this server catches that request, processes 
   it, and eventually delivers the index.html file (the frontend) back to their 
   browser so they can see the interface.
========================================================================
*/
package com.jcp.vto.jcpvtoexp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * @SpringBootApplication is a powerful convenience annotation that combines three critical functions:
 * 1. @Configuration: Tags this class as the primary source of application settings.
 * 2. @EnableAutoConfiguration: Tells Spring Boot to automatically configure the server based on your pom.xml libraries.
 * 3. @ComponentScan: Tells the engine to search this package (com.jcp.vto.jcpvtoexp) for other Java components.
 */
@SpringBootApplication
public class JcpvtoexpApplication {

    /**
     * The main entry point for the Java application. 
     * 
     * @param args Command line arguments passed during application startup.
     */
    public static void main(String[] args) {
        // SpringApplication.run bootstraps the framework, starting the embedded Tomcat web server, 
        // and officially making your backend live and ready to accept requests.
        SpringApplication.run(JcpvtoexpApplication.class, args);
    }

}