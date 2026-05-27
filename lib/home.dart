import 'package:flutter/material.dart';
import 'screens/profile_screen.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: _buildAppBar(context),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildHeroSection(context),
            _buildServiceCards(),
            _buildFooter(),
          ],
        ),
      ),
    );
  }

  // AppBar: Refleja la navegación profesional y limpia
  PreferredSizeWidget _buildAppBar(BuildContext context) {
    return AppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      title: Row(
        children: [
          const Icon(Icons.local_hospital, color: Color(0xFF2B4C7E), size: 30),
          const SizedBox(width: 10),
          Text('HOSPITAL', style: TextStyle(color: Colors.blueGrey[900], fontWeight: FontWeight.bold)),
        ],
      ),
      actions: [
        TextButton(onPressed: () {}, child: const Text('Servicios', style: TextStyle(color: Colors.black54))),
        TextButton(onPressed: () {}, child: const Text('Doctores', style: TextStyle(color: Colors.black54))),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
          child: ElevatedButton(
            onPressed: () {
              Navigator.push(
                context,
                // --- AQUÍ ESTÁ EL CAMBIO PRINCIPAL ---
                MaterialPageRoute(builder: (context) => const ProfileScreen()),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF4A90E2),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            ),
            child: const Text('Portal del Paciente'),
          ), // ElevatedButton
        ),
      ],
    );
  }

  // Hero Section: Mensaje de confianza y llamado a la acción (HU16)
  Widget _buildHeroSection(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(40),
      decoration: BoxDecoration(color: Colors.blue[50]?.withOpacity(0.3)),
      child: Row(
        children: [
          Expanded(
            flex: 1,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Tu Salud, \nNuestra Prioridad',
                  style: TextStyle(fontSize: 48, fontWeight: FontWeight.bold, color: Color(0xFF1A365D), height: 1.2),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () { /* Navegar a HU16: Agendar Cita */ },
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 20),
                    backgroundColor: const Color(0xFF1A365D),
                  ),
                  child: const Text('Agendar una Cita', style: TextStyle(fontSize: 18)),
                ),
              ],
            ),
          ),
          // Aquí iría el asset de la imagen del médico profesional
          Expanded(flex: 1, child: Image.network('https://via.placeholder.com/600x400', fit: BoxFit.cover)),
        ],
      ),
    );
  }

  // Service Cards: Basadas en funcionalidades del alcance
  Widget _buildServiceCards() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 60.0, horizontal: 20.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _cardItem(Icons.person_search, 'Buscar Doctor', 'Encuentra al especialista ideal para tu atención.'),
          _cardItem(Icons.medical_services, 'Especialidades', 'Contamos con diversas áreas médicas certificadas.'),
          _cardItem(Icons.history, 'Portal de Servicios', 'Acceso a tu historial y servicios digitales.'),
        ],
      ),
    );
  }

  Widget _cardItem(IconData icon, String title, String desc) {
    return Container(
      width: 250,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(15),
        boxShadow: [BoxShadow(color: Colors.grey.withOpacity(0.1), blurRadius: 10, spreadRadius: 5)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 40, color: const Color(0xFF4DB6AC)),
          const SizedBox(height: 15),
          Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          Text(desc, style: const TextStyle(color: Colors.black54)),
        ],
      ),
    );
  }

  Widget _buildFooter() {
    return Container(
      padding: const EdgeInsets.all(20),
      color: Colors.blueGrey[50],
      child: const Center(child: Text('© 2026 Hospital General - Ingeniería de Software UNAM')),
    );
  }
}