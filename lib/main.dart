import 'package:flutter/material.dart';
import 'home.dart'; // Esto llama a tu archivo de las tortugas ninja

void main() {
  runApp(const MaterialApp(
    debugShowCheckedModeBanner: false,
    home: HomePage(),
  ));
}