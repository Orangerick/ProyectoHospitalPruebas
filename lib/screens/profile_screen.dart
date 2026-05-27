import 'package:flutter/material.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  // 1. Controladores con datos PRECARGADOS (Simulando la base de datos)
  final nombreController = TextEditingController(text: "Leonardo Romero Hernández");
  final emailController = TextEditingController(text: "leonardo@ejemplo.com");
  final telefonoController = TextEditingController(text: "5512345678");

  // 2. Variable para simular la actualización en "Tiempo Real"
  String ultimaActualizacion = "Nunca";

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Actualización de Perfil'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // --- INDICADOR DE TIEMPO REAL ---
              Text(
                "Última sincronización: $ultimaActualizacion",
                style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 20),

              // --- FORMULARIO DE EDICIÓN ---
              TextField(
                controller: nombreController,
                decoration: const InputDecoration(
                  labelText: 'Nombre Completo',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.person),
                ),
              ),
              const SizedBox(height: 15),
              
              TextField(
                controller: emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Correo Electrónico',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.email),
                ),
              ),
              const SizedBox(height: 15),

              TextField(
                controller: telefonoController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Teléfono',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.phone),
                ),
              ),
              const SizedBox(height: 30),
              
              // --- BOTÓN DE ACTUALIZAR ---
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: () {
                    // setState hace la magia de actualizar la pantalla en "Tiempo Real"
                    setState(() {
                      ultimaActualizacion = "Justo ahora";
                    });

                    // Mostramos un mensaje visual al usuario
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Perfil sincronizado en tiempo real'),
                        backgroundColor: Colors.green,
                      ),
                    );

                    // Imprimimos en consola para el backend
                    print("=== PERFIL ACTUALIZADO ===");
                    print("Nombre: ${nombreController.text}");
                    print("Email: ${emailController.text}");
                    print("Teléfono: ${telefonoController.text}");
                  },
                  child: const Text('Guardar Cambios', style: TextStyle(fontSize: 18)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}