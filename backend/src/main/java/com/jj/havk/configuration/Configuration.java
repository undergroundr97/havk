package com.jj.havk.configuration;
import com.jj.havk.usuario.Usuario;
//import com.jj.havk.usuario.UsuarioRepository;
import com.jj.havk.usuario.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;



@org.springframework.context.annotation.Configuration
@Profile("dev")
public class Configuration implements CommandLineRunner {

    @Autowired
    UsuarioRepository usuarioRepository;

    @Override
    public void run(String... args) throws Exception {

        Usuario usuario = new Usuario(null, "vitor", "vitor@gmail.com", "123456789");

        usuarioRepository.save(usuario);

    }




}
