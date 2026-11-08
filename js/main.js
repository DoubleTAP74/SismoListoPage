/* =========================================================================
   SismoListo — Landing Page
   Interacciones con el usuario (Handbook, sección 5.3)

   HU-015  Lista sugerida para la mochila
   HU-018  Control de vencimientos  (badges de la lista)
   HU-020  Simulacro exprés cronometrado

   Cada bloque indica el criterio de aceptacion que implementa.
   ========================================================================= */

(function () {
  'use strict';

  /* Días de anticipación con los que se avisa un vencimiento.
     HU-018: "avisar quince días antes de que caduquen". */
  var DIAS_AVISO_VENCIMIENTO = 15;

  /* HU-015 CA03: agua sugerida = litros por persona y día × días de autonomía.
     Referencia: plan familiar de emergencia de INDECI y UNICEF. */
  var LITROS_PERSONA_DIA = 4;
  var DIAS_AUTONOMIA = 3;

  var MS_DIA = 24 * 60 * 60 * 1000;

  /* Iconos SVG incrustados. No dependen de ninguna fuente ni archivo
     externo, asi que se ven igual sin conexion, que es la condicion real
     en la que se usa SismoListo despues de un sismo. */
  var ICONOS = {
    mochila: '<path d="M7 9a5 5 0 0 1 10 0v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/><path d="M9.5 9V6.5a2.5 2.5 0 0 1 5 0V9"/><path d="M9.5 14h5v4h-5z"/>',
    mas: '<circle cx="12" cy="12" r="9"/><path d="M12 8.5v7M8.5 12h7"/>',
    meta: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
    cronometro: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5"/><path d="M9.5 2.5h5"/><path d="M12 2.5v3"/>',
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
    siguiente: '<path d="M4 12h15"/><path d="M13 6l6 6-6 6"/>',
    bandera: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
    repetir: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4.5v4h4"/>',
    agua: '<path d="M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3z"/>',
    medicina: '<rect x="3.2" y="8.8" width="17.6" height="6.4" rx="3.2" transform="rotate(-45 12 12)"/><path d="M9.2 9.2l5.6 5.6"/>',
    galleta: '<circle cx="12" cy="12" r="8.5"/><circle cx="10" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="11.5" cy="15" r="1" fill="currentColor" stroke="none"/>',
    mayor: '<circle cx="10" cy="4.5" r="2.2"/><path d="M10 7.5v7l-2 6"/><path d="M10 14.5l2.5 6"/><path d="M7 10.5h6"/><path d="M16.5 10v11"/>',
    nino: '<circle cx="12" cy="9" r="5"/><path d="M10 11.5a3 3 0 0 0 4 0"/><path d="M7 15.8c1.5 2 3.2 2.9 5 2.9s3.5-.9 5-2.9"/>',
    caja: '<path d="M3.5 7.5h17v12h-17z"/><path d="M3.5 7.5l2-4h13l2 4"/><path d="M12 3.5v4"/>',
    verificado: '<circle cx="12" cy="12" r="9"/><path d="M8 12.2l2.8 2.8L16 9.8"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    alerta: '<path d="M12 4L2.8 20h18.4z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
    guion: '<path d="M6 12h12"/>',
    cerrar: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'
  };

  function marcaSvg(nombre) {
    return '<svg class="hu-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      (ICONOS[nombre] || '') + '</svg>';
  }

  function svg(nombre, clase) {
    var s = document.createElement('span');
    s.className = 'hu-icono-caja' + (clase ? ' ' + clase : '');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = marcaSvg(nombre);
    return s;
  }


  function hoySinHora() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function sumarDias(dias) {
    return new Date(hoySinHora().getTime() + dias * MS_DIA);
  }

  function aISO(fecha) {
    var m = String(fecha.getMonth() + 1).padStart(2, '0');
    var d = String(fecha.getDate()).padStart(2, '0');
    return fecha.getFullYear() + '-' + m + '-' + d;
  }

  function formatearFecha(iso) {
    if (!iso) { return 'Sin fecha de vencimiento'; }
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  /* ---------------------------------------------------------------------
     HU-018 — Estado de vencimiento de cada articulo
     Vencido: la fecha ya pasó.
     Por vencer: faltan DIAS_AVISO_VENCIMIENTO días o menos.
     Vigente: falta mas que eso.
     El estado se comunica con color + ícono + texto, nunca solo con color
     (criterio de accesibilidad definido en el capítulo 4 del informe).
     --------------------------------------------------------------------- */
  function estadoVencimiento(iso) {
    if (!iso) {
      return { clave: 'sin-fecha', texto: 'Sin vencimiento', icono: 'guion' };
    }
    var partes = iso.split('-');
    var fecha = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
    fecha.setHours(0, 0, 0, 0);
    var dias = Math.round((fecha - hoySinHora()) / MS_DIA);

    if (dias < 0) {
      return { clave: 'vencido', texto: 'Vencido', icono: 'alerta', dias: dias };
    }
    if (dias <= DIAS_AVISO_VENCIMIENTO) {
      return { clave: 'por-vencer', texto: 'Por vencer', icono: 'reloj', dias: dias };
    }
    return { clave: 'vigente', texto: 'Vigente', icono: 'verificado', dias: dias };
  }

  /* =====================================================================
     HU-015 — Lista sugerida para la mochila
     ===================================================================== */

  var lista15 = document.getElementById('hu15-lista');

  if (lista15) {
    var inputIntegrantes = document.getElementById('hu15-integrantes');
    var checkAdultos = document.getElementById('hu15-adultos');
    var checkNinos = document.getElementById('hu15-ninos');
    var notaAgua = document.getElementById('hu15-nota-agua');
    var resumen15 = document.getElementById('hu15-resumen');
    var form15 = document.getElementById('hu15-form');

    /* Artículos personalizados que agrega la persona (HU-015 CA04). */
    var personalizados = [];

    function litrosDeAgua(integrantes) {
      return integrantes * LITROS_PERSONA_DIA * DIAS_AUTONOMIA;
    }

    /* HU-015 CA01 y CA02: la lista base sale de las recomendaciones de
       INDECI y UNICEF, y se completa según los integrantes del hogar. */
    function listaBase() {
      var integrantes = Math.max(1, Number(inputIntegrantes.value) || 1);
      var base = [
        {
          nombre: 'Agua embotellada',
          cantidad: litrosDeAgua(integrantes) + ' litros',
          icono: 'agua',
          vence: aISO(sumarDias(180)),
          origen: 'Calculada para ' + integrantes + (integrantes === 1 ? ' integrante' : ' integrantes')
        },
        {
          nombre: 'Medicamentos de uso diario',
          cantidad: '1 bolsa',
          icono: 'medicina',
          vence: aISO(sumarDias(10)),
          origen: 'Lista base INDECI / UNICEF'
        },
        {
          nombre: 'Galletas y conservas',
          cantidad: integrantes * 3 + ' raciones',
          icono: 'galleta',
          vence: aISO(sumarDias(-6)),
          origen: 'Lista base INDECI / UNICEF'
        }
      ];

      if (checkAdultos.checked) {
        base.push({
          nombre: 'Medicamentos para adultos mayores',
          cantidad: '1 kit',
          icono: 'mayor',
          vence: aISO(sumarDias(45)),
          origen: 'Agregado porque el hogar tiene adultos mayores'
        });
      }
      if (checkNinos.checked) {
        base.push({
          nombre: 'Pañales y fórmula infantil',
          cantidad: '1 paquete',
          icono: 'nino',
          vence: aISO(sumarDias(90)),
          origen: 'Agregado porque el hogar tiene niños pequeños'
        });
      }
      return base;
    }

    function crearItem(articulo, indicePersonalizado) {
      var estado = estadoVencimiento(articulo.vence);

      var li = document.createElement('li');
      li.className = 'hu15-item';

      var icono = svg(articulo.icono, 'hu15-item-icono');

      var cuerpo = document.createElement('div');
      cuerpo.className = 'hu15-item-cuerpo';

      var titulo = document.createElement('p');
      titulo.className = 'hu15-item-nombre';
      titulo.textContent = articulo.nombre;

      var detalle = document.createElement('p');
      detalle.className = 'hu15-item-detalle';
      detalle.textContent = articulo.cantidad + ' · Vence el ' + formatearFecha(articulo.vence);

      var origen = document.createElement('p');
      origen.className = 'hu15-item-origen';
      origen.textContent = articulo.origen;

      cuerpo.appendChild(titulo);
      cuerpo.appendChild(detalle);
      cuerpo.appendChild(origen);

      var badge = document.createElement('span');
      badge.className = 'hu15-badge hu15-badge--' + estado.clave;
      badge.appendChild(svg(estado.icono, 'hu15-badge-icono'));
      badge.appendChild(document.createTextNode(estado.texto));

      li.appendChild(icono);
      li.appendChild(cuerpo);
      li.appendChild(badge);

      /* Solo los artículos que agregó la persona se pueden quitar:
         es deshacer la acción del CA04, no editar la lista base. */
      if (typeof indicePersonalizado === 'number') {
        var quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.className = 'hu15-item-quitar';
        quitar.setAttribute('aria-label', 'Quitar ' + articulo.nombre + ' de la lista');
        quitar.appendChild(svg('cerrar', 'hu15-quitar-icono'));
        quitar.addEventListener('click', function () {
          personalizados.splice(indicePersonalizado, 1);
          pintarLista();
          anunciar('Se quitó ' + articulo.nombre + ' de la lista.');
        });
        li.appendChild(quitar);
      }

      return li;
    }

    function anunciar(mensaje) {
      resumen15.textContent = mensaje;
    }

    function pintarLista() {
      var base = listaBase();
      lista15.innerHTML = '';

      base.forEach(function (a) { lista15.appendChild(crearItem(a)); });
      personalizados.forEach(function (a, i) { lista15.appendChild(crearItem(a, i)); });

      var total = base.length + personalizados.length;
      var porVencer = 0;
      var vencidos = 0;
      base.concat(personalizados).forEach(function (a) {
        var e = estadoVencimiento(a.vence);
        if (e.clave === 'por-vencer') { porVencer++; }
        if (e.clave === 'vencido') { vencidos++; }
      });

      var texto = total + ' artículos en la lista';
      if (vencidos > 0) { texto += ' · ' + vencidos + ' vencido' + (vencidos > 1 ? 's' : ''); }
      if (porVencer > 0) { texto += ' · ' + porVencer + ' por vencer'; }
      resumen15.textContent = texto;

      var integrantes = Math.max(1, Number(inputIntegrantes.value) || 1);
      notaAgua.textContent = 'Se sugieren ' + litrosDeAgua(integrantes) + ' litros de agua: ' +
        LITROS_PERSONA_DIA + ' litros por persona al día durante ' + DIAS_AUTONOMIA + ' días.';
    }

    function mostrarError(idCampo, mensaje) {
      var campo = document.getElementById(idCampo);
      var error = document.getElementById('hu15-error-' + idCampo.replace('hu15-', ''));
      if (!error) { return; }
      if (mensaje) {
        error.textContent = mensaje;
        error.hidden = false;
        campo.setAttribute('aria-invalid', 'true');
      } else {
        error.textContent = '';
        error.hidden = true;
        campo.removeAttribute('aria-invalid');
      }
    }

    /* HU-015 CA04 — agregar artículos personalizados, con validación. */
    form15.addEventListener('submit', function (evento) {
      evento.preventDefault();

      var campoNombre = document.getElementById('hu15-nombre');
      var campoCantidad = document.getElementById('hu15-cantidad');
      var campoVence = document.getElementById('hu15-vencimiento');

      var nombre = campoNombre.value.trim();
      var cantidad = Number(campoCantidad.value);
      var vence = campoVence.value;
      var valido = true;

      if (nombre.length < 3) {
        mostrarError('hu15-nombre', 'Escribe el nombre del artículo (mínimo 3 caracteres).');
        valido = false;
      } else {
        mostrarError('hu15-nombre', '');
      }

      if (!cantidad || cantidad < 1) {
        mostrarError('hu15-cantidad', 'La cantidad debe ser 1 o más.');
        valido = false;
      } else {
        mostrarError('hu15-cantidad', '');
      }

      mostrarError('hu15-vencimiento', '');

      if (!valido) {
        campoNombre.focus();
        return;
      }

      personalizados.push({
        nombre: nombre,
        cantidad: cantidad + (cantidad === 1 ? ' unidad' : ' unidades'),
        icono: 'caja',
        vence: vence,
        origen: 'Agregado por ti'
      });

      form15.reset();
      campoCantidad.value = 1;
      pintarLista();
      anunciar('Se agregó ' + nombre + ' a la lista.');
      campoNombre.focus();
    });

    inputIntegrantes.addEventListener('input', pintarLista);
    checkAdultos.addEventListener('change', pintarLista);
    checkNinos.addEventListener('change', pintarLista);

    pintarLista();
  }

  /* =====================================================================
     HU-020 — Simulacro exprés cronometrado
     ===================================================================== */

  var panel20 = document.getElementById('hu20-panel');

  if (panel20) {
    /* HU-020 CA02: los pasos se muestran de uno en uno, nunca todos a la vez.
       Es la misma decisión del protocolo del prototipo: una sola acción
       visible reduce la carga cognitiva durante el sismo. */
    var PASOS = [
      {
        titulo: 'Agáchate, cúbrete y sujétate',
        detalle: 'Ubícate en tu zona segura dentro de la vivienda y protege tu cabeza y tu cuello.'
      },
      {
        titulo: 'Espera a que termine el movimiento',
        detalle: 'No corras ni salgas mientras tiembla. Mantente en la zona segura hasta que pare.'
      },
      {
        titulo: 'Evacúa por la ruta registrada',
        detalle: 'Sal con calma por la ruta de evacuación del plan. No uses el ascensor.'
      },
      {
        titulo: 'Reúnete en el punto de encuentro',
        detalle: 'Llega al punto de encuentro de tu familia y verifica que estén todos.'
      }
    ];

    var pantallaTiempo = document.getElementById('hu20-tiempo');
    var botonPrincipal = document.getElementById('hu20-btn');
    var textoBoton = document.getElementById('hu20-btn-texto');
    var iconoBoton = document.getElementById('hu20-btn-icono');
    var botonCancelar = document.getElementById('hu20-cancelar');
    var tarjeta = document.getElementById('hu20-tarjeta');

    var estado = 'inactivo';
    var pasoActual = 0;
    var segundos = 0;
    var intervalo = null;

    function formatoReloj(total) {
      var m = String(Math.floor(total / 60)).padStart(2, '0');
      var s = String(total % 60).padStart(2, '0');
      return m + ':' + s;
    }

    function pintarReloj() {
      pantallaTiempo.textContent = formatoReloj(segundos);
    }

    function pintarPaso() {
      tarjeta.hidden = false;
      tarjeta.className = 'hu20-tarjeta hu20-tarjeta--activa';
      tarjeta.innerHTML = '';

      var etiqueta = document.createElement('p');
      etiqueta.className = 'hu20-paso-etiqueta';
      etiqueta.textContent = 'Paso ' + (pasoActual + 1) + ' de ' + PASOS.length;

      var titulo = document.createElement('h3');
      titulo.className = 'hu20-paso-titulo';
      titulo.textContent = PASOS[pasoActual].titulo;

      var detalle = document.createElement('p');
      detalle.className = 'hu20-paso-detalle';
      detalle.textContent = PASOS[pasoActual].detalle;

      var barra = document.createElement('div');
      barra.className = 'hu20-progreso';
      barra.setAttribute('role', 'progressbar');
      barra.setAttribute('aria-valuemin', '1');
      barra.setAttribute('aria-valuemax', String(PASOS.length));
      barra.setAttribute('aria-valuenow', String(pasoActual + 1));
      barra.setAttribute('aria-label', 'Avance del simulacro');
      for (var i = 0; i < PASOS.length; i++) {
        var punto = document.createElement('span');
        punto.className = 'hu20-progreso-punto' + (i <= pasoActual ? ' hu20-progreso-punto--hecho' : '');
        barra.appendChild(punto);
      }

      tarjeta.appendChild(etiqueta);
      tarjeta.appendChild(titulo);
      tarjeta.appendChild(detalle);
      tarjeta.appendChild(barra);

      /* HU-020 CA03: el último paso es llegar al punto de encuentro,
         y es la acción que cierra el simulacro. */
      if (pasoActual === PASOS.length - 1) {
        textoBoton.textContent = 'Llegué al punto de encuentro';
        iconoBoton.innerHTML = marcaSvg('bandera');
      } else {
        textoBoton.textContent = 'Siguiente paso';
        iconoBoton.innerHTML = marcaSvg('siguiente');
      }
    }

    function iniciar() {
      estado = 'corriendo';
      pasoActual = 0;
      segundos = 0;
      pintarReloj();
      intervalo = setInterval(function () {
        segundos++;
        pintarReloj();
      }, 1000);

      botonPrincipal.classList.add('hu20-btn-principal--activo');
      botonCancelar.hidden = false;
      pintarPaso();
    }

    function detenerReloj() {
      if (intervalo) {
        clearInterval(intervalo);
        intervalo = null;
      }
    }

    function finalizar() {
      detenerReloj();
      estado = 'finalizado';

      botonCancelar.hidden = true;
      botonPrincipal.classList.remove('hu20-btn-principal--activo');
      textoBoton.textContent = 'Repetir simulacro';
      iconoBoton.innerHTML = marcaSvg('repetir');

      tarjeta.className = 'hu20-tarjeta hu20-tarjeta--final';
      tarjeta.innerHTML = '';

      var titulo = document.createElement('h3');
      titulo.className = 'hu20-paso-titulo';
      titulo.textContent = 'Simulacro completado';

      var detalle = document.createElement('p');
      detalle.className = 'hu20-paso-detalle';
      detalle.textContent = 'Tu familia llegó al punto de encuentro en ' + formatoReloj(segundos) +
        ' (minutos y segundos), completando los ' + PASOS.length + ' pasos del plan.';

      var nota = document.createElement('p');
      nota.className = 'hu20-paso-nota';
      nota.textContent = 'Practicar una vez al mes acorta este tiempo.';

      tarjeta.appendChild(titulo);
      tarjeta.appendChild(detalle);
      tarjeta.appendChild(nota);
    }

    /* HU-020 CA04: cancelar sin registrar deja el simulacro en cero. */
    function cancelar() {
      detenerReloj();
      estado = 'inactivo';
      segundos = 0;
      pasoActual = 0;
      pintarReloj();

      botonCancelar.hidden = true;
      botonPrincipal.classList.remove('hu20-btn-principal--activo');
      textoBoton.textContent = 'Iniciar simulacro';
      iconoBoton.innerHTML = marcaSvg('play');

      tarjeta.className = 'hu20-tarjeta hu20-tarjeta--cancelado';
      tarjeta.hidden = false;
      tarjeta.innerHTML = '';

      var titulo = document.createElement('h3');
      titulo.className = 'hu20-paso-titulo';
      titulo.textContent = 'Simulacro cancelado';

      var detalle = document.createElement('p');
      detalle.className = 'hu20-paso-detalle';
      detalle.textContent = 'No se registró ningún tiempo. Puedes iniciarlo de nuevo cuando quieras.';

      tarjeta.appendChild(titulo);
      tarjeta.appendChild(detalle);
    }

    botonPrincipal.addEventListener('click', function () {
      if (estado === 'inactivo' || estado === 'finalizado') {
        iniciar();
        return;
      }
      if (estado === 'corriendo') {
        if (pasoActual < PASOS.length - 1) {
          pasoActual++;
          pintarPaso();
        } else {
          finalizar();
        }
      }
    });

    botonCancelar.addEventListener('click', cancelar);

    pintarReloj();
  }
})();

/* Navegación principal responsive. Boton Hamburguesa de enlaces */
(function () {
  'use strict';

  var botonMenu = document.getElementById('boton-menu');
  var navegacion = document.getElementById('navegacion');
  var textoMenu = document.getElementById('texto-menu');

  if (!botonMenu || !navegacion || !textoMenu) return;

  var pantallaMovil = window.matchMedia('(max-width: 870px)');

  function cambiarMenu(abrir) {
    navegacion.hidden = pantallaMovil.matches && !abrir;
    botonMenu.setAttribute('aria-expanded', String(abrir));
    botonMenu.setAttribute('aria-label', abrir ? 'Cerrar menú' : 'Abrir menú');
    textoMenu.textContent = abrir ? 'Cerrar' : 'Menú';
  }

  botonMenu.addEventListener('click', function () {
    var estaAbierto = botonMenu.getAttribute('aria-expanded') === 'true';
    cambiarMenu(!estaAbierto);
  });

  navegacion.addEventListener('click', function (evento) {
    var enlace = evento.target.closest('a');
    if (!enlace) return;
    cambiarMenu(false);
  });

  document.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape' && pantallaMovil.matches && !navegacion.hidden) {
      cambiarMenu(false);
      botonMenu.focus();
    }
  });

  function ajustarPantalla() {
    cambiarMenu(false);
  }

  if (typeof pantallaMovil.addEventListener === 'function') {
    pantallaMovil.addEventListener('change', ajustarPantalla);
  } else {
    pantallaMovil.addListener(ajustarPantalla);
  }

  ajustarPantalla();
})();

/* =====================================================================
     SECCIÓN 1 — Configuración Inicial y Gestión del Hogar (Pasos 1 al 9)
     ===================================================================== */

(function () {
  var seccionConfig = document.getElementById('seccion-configuracioninicial-gestionhogar');

  if (seccionConfig) {
    var pasoItems = seccionConfig.querySelectorAll('.pasos-barra .paso-item');
    var stepForms = seccionConfig.querySelectorAll('.pasos-contenido .step-form');

    // 1. Control de navegación entre pasos al hacer clic en la barra superior
    pasoItems.forEach(function (item, index) {
      item.addEventListener('click', function () {
        activarPaso(index);
      });
    });

    function activarPaso(indice) {
      pasoItems.forEach(function (el, i) {
        if (i === indice) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });

      stepForms.forEach(function (form, i) {
        if (i === indice) {
          form.classList.add('active');
        } else {
          form.classList.remove('active');
        }
      });
      actualizarBarraSeccion1();
    }

    // 2. Botones de "Continuar" / "Guardar y continuar" dentro de los formularios y pasos
    var botonesContinuar = seccionConfig.querySelectorAll('.step-form .btn-enviar');
    botonesContinuar.forEach(function (btn, index) {
      btn.addEventListener('click', function (e) {
        var formActual = btn.closest('form');

        // Si el botón pertenece a un formulario, validamos la entrada nativa
        if (formActual) {
          if (!formActual.checkValidity()) {
            formActual.reportValidity();
            return; // Detiene el avance si hay campos obligatorios vacíos
          }
          e.preventDefault(); // Previene envío real si es simulación con iframe oculto
        }

        // Avanzar automáticamente al siguiente paso si existe
        var siguienteIndice = index + 1;
        if (siguienteIndice < stepForms.length) {
          activarPaso(siguienteIndice);
        }

        // Saltar automaticamente al paso 1 si completo el paso final
        var pasoFinal = stepForms.length - 1;
        if (pasoFinal === index) {
          activarPaso(0);
        }
      });
    });

    // 3. Interactividad específica del Paso 5: Selección de Integrantes para Asignación de Roles (HU-007)
    var integranteItems = seccionConfig.querySelectorAll('.integrante-item');
    var inputRolAsignado = seccionConfig.querySelector('#form-rol input[type="text"]');

    integranteItems.forEach(function (item) {
      item.addEventListener('click', function () {
        // Remover clase seleccionada de todos y añadir al actual
        integranteItems.forEach(function (el) {
          el.style.backgroundColor = '';
          el.style.padding = '';
          el.style.borderColor = '';
        });
        item.style.backgroundColor = 'var(--naranja-suave)';
        item.style.padding = '10px';
        item.style.borderColor = 'var(--naranja-acento)';

        var nombreIntegrante = item.getAttribute('data-integrante');
        if (inputRolAsignado) {
          inputRolAsignado.placeholder = 'Asignar rol a ' + nombreIntegrante + ' (Ej. Llevar mochila)';
          inputRolAsignado.focus();
        }
      });
    });
  }
})();

/* =====================================================================
   SECCIÓN 3 — Respuesta Inmediata y Modo Emergencia
   ===================================================================== */
(function () {
  var seccionEmergencia = document.getElementById('seccion-emergencia-respuestainmediata');

  if (seccionEmergencia) {
    // Función auxiliar para cambiar entre pasos principales de la emergencia
    function mostrarPasoEmergencia(idStep) {
      var pasos = seccionEmergencia.querySelectorAll('.hu-zone-container > .step-emergencia');
      pasos.forEach(function (paso) {
        if (paso.id === idStep) {
          paso.classList.add('active');
        } else {
          paso.classList.remove('active');
        }
      });
    }

    // 1. Activar Modo Emergencia desde el Paso 1
    var btnActivar = seccionEmergencia.querySelector('.btn-emergencia-activar');
    if (btnActivar) {
      btnActivar.addEventListener('click', function () {
        mostrarPasoEmergencia('emergencia-step-2');
      });
    }

    // 2. Navegación interna de la Guía de Evacuación (Sub-pasos del Paso 2)
    var botonesSubpasos = seccionEmergencia.querySelectorAll('#emergencia-step-2 [data-next]');
    botonesSubpasos.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var siguienteId = btn.getAttribute('data-next');

        // Si el destino es un paso principal (ej. emergencia-step-3) o un subpaso
        if (siguienteId.startsWith('emergencia-step-')) {
          mostrarPasoEmergencia(siguienteId);
        } else {
          // Es un subpaso dentro del paso 2
          var subpasos = seccionEmergencia.querySelectorAll('#emergencia-step-2 .step-emergencia');
          subpasos.forEach(function (sub) {
            if (sub.id === siguienteId) {
              sub.classList.add('active');
            } else {
              sub.classList.remove('active');
            }
          });
        }
      });
    });

    // 3. Selección de Estado Inicial ("Estoy bien" vs "Necesito ayuda") en Paso 3
    var btnEstoyBien = seccionEmergencia.querySelector('.btn-estoy-bien');
    var btnNecesitoAyuda = seccionEmergencia.querySelector('.btn-necesito-ayuda');

    if (btnEstoyBien) {
      btnEstoyBien.addEventListener('click', function () {
        mostrarPasoEmergencia('emergencia-step-5');
      });
    }

    if (btnNecesitoAyuda) {
      btnNecesitoAyuda.addEventListener('click', function () {
        mostrarPasoEmergencia('emergencia-step-4');
      });
    }

    // 4. Envío del Formulario de Ayuda (Paso 4 -> Paso 5)
    var formAyuda = seccionEmergencia.querySelector('#form-solicitud-ayuda');
    if (formAyuda) {
      formAyuda.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!formAyuda.checkValidity()) {
          formAyuda.reportValidity();
          return;
        }
        mostrarPasoEmergencia('emergencia-step-5');
      });
    }

    // 5. Botón para contactar a integrante pendiente en Paso 5 -> Paso 6
    var btnContactarPendiente = seccionEmergencia.querySelector('.btn-contactar-pendiente');
    if (btnContactarPendiente) {
      btnContactarPendiente.addEventListener('click', function () {
        mostrarPasoEmergencia('emergencia-step-6');
      });
    }

    // 6. Envío de Mensaje Rápido en Paso 6 -> Paso 7
    var formMensajeRapido = seccionEmergencia.querySelector('#form-mensaje-rapido');
    if (formMensajeRapido) {
      formMensajeRapido.addEventListener('submit', function (e) {
        e.preventDefault();
        mostrarPasoEmergencia('emergencia-step-7');
      });
    }

    // 7. Cierre del Modo Emergencia (Paso 7 -> Regresar al Paso 1)
    var btnCerrarEmergencia = seccionEmergencia.querySelector('#emergencia-step-7 .btn-enviar');
    if (btnCerrarEmergencia) {
      btnCerrarEmergencia.addEventListener('click', function () {
        // Reiniciar subpasos del paso 2 al inicial por si se vuelve a abrir
        var subpasos = seccionEmergencia.querySelectorAll('#emergencia-step-2 .step-emergencia');
        subpasos.forEach(function (sub, index) {
          if (index === 0) {
            sub.classList.add('active');
          } else {
            sub.classList.remove('active');
          }
        });
        mostrarPasoEmergencia('emergencia-step-1');
      });
    }
  }
})();

/* =====================================================================
   SECCIÓN 4 — Accesibilidad e Inclusión (Funciones 1 al 7)
   ===================================================================== */
(function () {
  var seccionAccesibilidad = document.getElementById('seccion-accesibilidad-inclusion');

  if (seccionAccesibilidad) {
    var accPasoItems = seccionAccesibilidad.querySelectorAll('.pasos-barra .paso-item');
    var accStepForms = seccionAccesibilidad.querySelectorAll('.pasos-contenido .step-form');

    // Control de navegación al hacer clic en los botones de la barra superior de accesibilidad
    accPasoItems.forEach(function (item, index) {
      item.addEventListener('click', function () {
        activarFuncionAcc(index);
      });
    });

    function activarFuncionAcc(indice) {
      // Activar o desactivar botones de la barra superior
      accPasoItems.forEach(function (el, i) {
        if (i === indice) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });

      // Mostrar el contenido correspondiente y ocultar los demás
      accStepForms.forEach(function (form, i) {
        if (i === indice) {
          form.classList.add('active');
        } else {
          form.classList.remove('active');
        }
      });
    }

    // Mostrar el badge de "Imagen compartida con éxito" al hacer clic en el botón de compartir como imagen
    var btnCompartirImagen = seccionAccesibilidad.querySelector('.btn-enviar');
    var avisoImagenCompartida = seccionAccesibilidad.querySelector('.aviso-imagen-compartida');
    function mostrarAvisoImagen() {
      if (avisoImagenCompartida) {
        avisoImagenCompartida.style.display = 'flex';
        setTimeout(function () {
          avisoImagenCompartida.style.display = 'none';
        }, 30000); // Ocultar después de 3 segundos
      }
    }

    if (btnCompartirImagen) {
      btnCompartirImagen.addEventListener('click', mostrarAvisoImagen);
    }
  }
})();