/* =========================================================================
   SismoListo — Landing Page
   Interacciones con el usuario (Handbook, sección 5.3)

   HU-015  Lista sugerida para la mochila
   HU-016  Registro de artículos reunidos
   HU-018  Control de vencimientos  (badges de la lista)
   HU-020  Simulacro exprés cronometrado
   HU-023  Recordatorio mensual de simulacro

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

  /* Lectura y escritura en el dispositivo. Si el navegador bloquea el
     almacenamiento (modo privado), la página sigue funcionando igual,
     solo que no recuerda los cambios al recargar. */
  function leerGuardado(clave, porDefecto) {
    try {
      var valor = window.localStorage.getItem(clave);
      return valor ? JSON.parse(valor) : porDefecto;
    } catch (e) {
      return porDefecto;
    }
  }

  function guardar(clave, valor) {
    try {
      window.localStorage.setItem(clave, JSON.stringify(valor));
    } catch (e) { /* sin almacenamiento: se mantiene solo en memoria */ }
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

    /* HU-016: artículos marcados como "Lo tengo", por nombre.
       CA04: se guardan solos en el dispositivo, sin botón adicional. */
    var CLAVE_REUNIDOS = 'sismolisto-hu16-reunidos';
    var reunidos = leerGuardado(CLAVE_REUNIDOS, {});
    var checkSoloFaltantes = document.getElementById('hu16-solo-faltantes');
    var contador16 = document.getElementById('hu16-contador');
    var avance16 = document.getElementById('hu16-avance');

    function claveArticulo(articulo) {
      return articulo.nombre.trim().toLowerCase();
    }

    /* HU-018 CA03: un artículo vencido vuelve a figurar como faltante,
       aunque antes se haya marcado como "Lo tengo". */
    function estaReunido(articulo) {
      if (estadoVencimiento(articulo.vence).clave === 'vencido') { return false; }
      return reunidos[claveArticulo(articulo)] === true;
    }

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

      /* HU-016 CA01: cada artículo se puede marcar como "Lo tengo". */
      var pie = document.createElement('div');
      pie.className = 'hu15-item-pie';
      pie.appendChild(badge);

      var idCheck = 'hu16-tengo-' + claveArticulo(articulo).replace(/[^a-z0-9]+/g, '-');
      var etiquetaTengo = document.createElement('label');
      etiquetaTengo.className = 'hu16-tengo';
      etiquetaTengo.setAttribute('for', idCheck);
      var checkTengo = document.createElement('input');
      checkTengo.type = 'checkbox';
      checkTengo.id = idCheck;
      checkTengo.checked = estaReunido(articulo);
      var textoTengo = document.createElement('span');

      if (estado.clave === 'vencido') {
        /* HU-018 CA03: hay que reemplazarlo antes de volver a marcarlo. */
        checkTengo.disabled = true;
        textoTengo.textContent = 'Reemplázalo para marcarlo';
      } else {
        textoTengo.textContent = 'Lo tengo';
        checkTengo.addEventListener('change', function () {
          if (checkTengo.checked) {
            reunidos[claveArticulo(articulo)] = true;
          } else {
            delete reunidos[claveArticulo(articulo)];
          }
          guardar(CLAVE_REUNIDOS, reunidos);
          pintarLista();
          var foco = document.getElementById(idCheck);
          if (foco) { foco.focus(); }
        });
      }
      etiquetaTengo.appendChild(checkTengo);
      etiquetaTengo.appendChild(textoTengo);
      pie.appendChild(etiquetaTengo);

      if (checkTengo.checked) { li.classList.add('hu15-item--reunido'); }

      li.appendChild(icono);
      li.appendChild(cuerpo);
      li.appendChild(pie);

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

      /* HU-016 CA03: con el filtro activo solo se ven los faltantes. */
      var soloFaltantes = checkSoloFaltantes && checkSoloFaltantes.checked;
      var visibles = 0;
      base.forEach(function (a) {
        if (soloFaltantes && estaReunido(a)) { return; }
        lista15.appendChild(crearItem(a));
        visibles++;
      });
      personalizados.forEach(function (a, i) {
        if (soloFaltantes && estaReunido(a)) { return; }
        lista15.appendChild(crearItem(a, i));
        visibles++;
      });
      if (visibles === 0) {
        var vacio = document.createElement('li');
        vacio.className = 'hu16-vacio';
        vacio.textContent = 'Ya tienes todo lo de la lista. Revisa las fechas de vencimiento cada mes.';
        lista15.appendChild(vacio);
      }

      /* HU-016 CA02: contador de artículos reunidos sobre el total. */
      var todos = base.concat(personalizados);
      var cuantosReunidos = todos.filter(estaReunido).length;
      contador16.textContent = cuantosReunidos + ' de ' + todos.length + ' artículos reunidos' +
        (todos.length - cuantosReunidos > 0 ? ' · te faltan ' + (todos.length - cuantosReunidos) : ' · ¡mochila completa!');
      avance16.style.width = (todos.length ? Math.round(cuantosReunidos * 100 / todos.length) : 0) + '%';

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

      /* HU-018 CA04: no se acepta una fecha de vencimiento anterior a hoy. */
      if (vence && vence < aISO(hoySinHora())) {
        mostrarError('hu15-vencimiento', 'La fecha de vencimiento no puede ser anterior a hoy (' +
          formatearFecha(aISO(hoySinHora())) + ').');
        valido = false;
      } else {
        mostrarError('hu15-vencimiento', '');
      }

      if (!valido) {
        var primerError = form15.querySelector('[aria-invalid="true"]');
        (primerError || campoNombre).focus();
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
    checkSoloFaltantes.addEventListener('change', pintarLista);

    /* HU-018 CA04: el calendario tampoco ofrece días pasados. */
    document.getElementById('hu15-vencimiento').min = aISO(hoySinHora());

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

    var CLAVE_HISTORIAL = 'sismolisto-hu022-historial';
    function duracion(total) {
      var m = Math.floor(total / 60), s = total % 60;
      return (m ? m + ' min ' : '') + s + ' s';
    }

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

      /* HU-022 CA02 y CA03: comparación con el simulacro anterior,
         con un mensaje de logro o una sugerencia concreta. */
      var historial = leerGuardado(CLAVE_HISTORIAL, null) || [
        { fecha: '28/08/2026', segundos: 108 }
      ];
      var anterior = historial[historial.length - 1];
      var diferencia = anterior.segundos - segundos;
      var nota = document.createElement('p');
      nota.className = 'hu20-paso-nota';
      if (diferencia > 0) {
        nota.textContent = '¡Mejoraron! Tardaron ' + duracion(diferencia) + ' menos que en el simulacro anterior (' +
          duracion(anterior.segundos) + ').';
      } else {
        nota.textContent = 'Tardaron ' + duracion(-diferencia) + ' más que en el simulacro anterior (' +
          duracion(anterior.segundos) + '). Sugerencia: dejen la mochila junto a la puerta y repasen la ruta antes del próximo simulacro.';
      }

      /* HU-022 CA04: el resultado se guarda en el historial. */
      historial.push({ fecha: formatearFecha(aISO(hoySinHora())), segundos: segundos });
      guardar(CLAVE_HISTORIAL, historial);
      var lista = document.createElement('p');
      lista.className = 'hu20-paso-nota';
      lista.textContent = 'Historial: ' + historial.slice(-3).map(function (h) {
        return h.fecha + ' · ' + duracion(h.segundos);
      }).join(' | ') + '.';

      tarjeta.appendChild(titulo);
      tarjeta.appendChild(detalle);
      tarjeta.appendChild(nota);
      tarjeta.appendChild(lista);
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

    /* ===================================================================
       HU-023 — Recordatorio mensual de simulacro
       =================================================================== */
    var form23 = document.getElementById('hu23-form');

    if (form23) {
      var CLAVE_RECORDATORIO = 'sismolisto-hu23-recordatorio';
      var selectDia = document.getElementById('hu23-dia');
      var campoHora = document.getElementById('hu23-hora');
      var errorHora = document.getElementById('hu23-error-hora');
      var botonGuardar23 = document.getElementById('hu23-guardar');
      var estado23 = document.getElementById('hu23-estado');
      var acciones23 = document.getElementById('hu23-acciones');
      var aviso23 = document.getElementById('hu23-aviso');
      var recordatorio = leerGuardado(CLAVE_RECORDATORIO, null);

      /* CA01: días 1 a 28, para que el aviso exista en todos los meses. */
      for (var dia = 1; dia <= 28; dia++) {
        var opcion = document.createElement('option');
        opcion.value = String(dia);
        opcion.textContent = 'Día ' + dia;
        selectDia.appendChild(opcion);
      }
      selectDia.value = '15';

      function proximaFecha(diaMes, hora) {
        var partes = hora.split(':');
        var ahora = new Date();
        var fecha = new Date(ahora.getFullYear(), ahora.getMonth(), diaMes, Number(partes[0]), Number(partes[1]));
        if (fecha <= ahora) {
          fecha = new Date(ahora.getFullYear(), ahora.getMonth() + 1, diaMes, Number(partes[0]), Number(partes[1]));
        }
        return fecha;
      }

      function pintarRecordatorio() {
        if (recordatorio) {
          selectDia.value = String(recordatorio.dia);
          campoHora.value = recordatorio.hora;
          var proxima = proximaFecha(recordatorio.dia, recordatorio.hora);
          estado23.textContent = 'Activo: el día ' + recordatorio.dia + ' de cada mes a las ' + recordatorio.hora +
            '. Próximo aviso: ' + formatearFecha(aISO(proxima)) + '.';
          estado23.className = 'hu23-estado hu23-estado--activo';
          botonGuardar23.textContent = 'Guardar cambios';
          acciones23.hidden = false;
        } else {
          estado23.textContent = 'Sin recordatorio programado.';
          estado23.className = 'hu23-estado';
          botonGuardar23.textContent = 'Programar recordatorio';
          acciones23.hidden = true;
          aviso23.hidden = true;
        }
      }

      /* CA01 y CA04: programar o modificar el día y la hora. */
      form23.addEventListener('submit', function (evento) {
        evento.preventDefault();
        if (!campoHora.value) {
          errorHora.textContent = 'Elige la hora del recordatorio.';
          errorHora.hidden = false;
          campoHora.setAttribute('aria-invalid', 'true');
          campoHora.focus();
          return;
        }
        errorHora.hidden = true;
        campoHora.removeAttribute('aria-invalid');
        recordatorio = { dia: Number(selectDia.value), hora: campoHora.value };
        guardar(CLAVE_RECORDATORIO, recordatorio);
        pintarRecordatorio();
      });

      /* CA04: desactivar el recordatorio. */
      document.getElementById('hu23-desactivar').addEventListener('click', function () {
        recordatorio = null;
        guardar(CLAVE_RECORDATORIO, null);
        pintarRecordatorio();
        botonGuardar23.focus();
      });

      /* CA02: vista previa del aviso que reciben los integrantes. */
      document.getElementById('hu23-vista').addEventListener('click', function () {
        aviso23.hidden = false;
        document.getElementById('hu23-iniciar').focus();
      });

      /* CA03: desde el aviso se inicia el simulacro directamente. */
      document.getElementById('hu23-iniciar').addEventListener('click', function () {
        aviso23.hidden = true;
        if (estado !== 'corriendo') { iniciar(); }
        panel20.scrollIntoView({ behavior: 'smooth', block: 'start' });
        botonPrincipal.focus({ preventScroll: true });
      });

      pintarRecordatorio();
    }
  }
})();

/* Navegación principal responsive. Boton Hamburguesa de enlaces */
(function () {
  'use strict';

  var botonMenu = document.getElementById('boton-menu');
  var navegacion = document.getElementById('navegacion');
  var textoMenu = document.getElementById('texto-menu');

  if (!botonMenu || !navegacion || !textoMenu) return;

  var pantallaMovil = window.matchMedia('(max-width: 1220px)');

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
        el.setAttribute('aria-selected', String(i === indice));
      });

      stepForms.forEach(function (form, i) {
        if (i === indice) {
          form.classList.add('active');
        } else {
          form.classList.remove('active');
        }
      });
      actualizarBarraSeccion1(indice);
    }

    /* Corrección: esta función se llamaba pero no existía (ReferenceError en
       la consola). Mantiene visible el paso activo cuando la barra de pasos
       se desplaza en pantallas angostas. */
    function actualizarBarraSeccion1(indice) {
      var barra = seccionConfig.querySelector('.pasos-barra');
      var activo = pasoItems[indice];
      if (!barra || !activo) { return; }
      barra.scrollLeft = activo.offsetLeft - (barra.clientWidth - activo.clientWidth) / 2;
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

        // Avanzar al paso siguiente al que contiene el botón; desde el último, volver al primero.
        // Se usa el paso del botón (y no su posición en la lista) para que un paso
        // pueda tener más de un botón .btn-enviar.
        var pasoActual = Array.prototype.indexOf.call(stepForms, btn.closest('.step-form'));
        var siguienteIndice = pasoActual + 1;
        activarPaso(siguienteIndice < stepForms.length ? siguienteIndice : 0);
      });
    });

    // HU-001 CA02: mensaje propio y en español cuando el celular no tiene 9 dígitos
    var campoCelular = seccionConfig.querySelector('#reg-celular');
    if (campoCelular) {
      // HU-001 CA03: número ya asociado a otra cuenta (en la demostración, el de Carlos Huamán)
      var NUMERO_REGISTRADO = '955123456';
      function revisarCelular() {
        campoCelular.setCustomValidity(campoCelular.value.trim() === NUMERO_REGISTRADO
          ? 'Este número ya está asociado a otra cuenta. Inicia sesión o usa otro número.'
          : '');
      }
      campoCelular.addEventListener('invalid', function () {
        if (campoCelular.value.trim() === NUMERO_REGISTRADO) { return; }
        campoCelular.setCustomValidity(campoCelular.validity.valueMissing
          ? 'Escribe tu número de celular.'
          : 'El celular debe tener 9 dígitos, por ejemplo 987654321.');
      });
      campoCelular.addEventListener('input', revisarCelular);
    }

    // HU-006 — Invitación de integrantes al plan (Paso 4)
    var codigoVence = seccionConfig.querySelector('#codigo-vence');
    var codigoEstado = seccionConfig.querySelector('#codigo-estado');
    var codigo = seccionConfig.querySelector('#codigo-invitacion');
    if (codigoVence && codigo) {
      // CA03: el código vence 48 horas después de generarse
      var vence = new Date(Date.now() + 48 * 60 * 60 * 1000);
      var dd = String(vence.getDate()).padStart(2, '0');
      var mm = String(vence.getMonth() + 1).padStart(2, '0');
      var hh = String(vence.getHours()).padStart(2, '0');
      var mi = String(vence.getMinutes()).padStart(2, '0');
      codigoVence.textContent = 'Vence en 48 horas: ' + dd + '/' + mm + '/' + vence.getFullYear() +
        ' a las ' + hh + ':' + mi + '.';

      // CA02: compartir por SMS o por una aplicación de mensajería
      seccionConfig.querySelectorAll('.btn-compartir-invitacion').forEach(function (btn) {
        btn.addEventListener('click', function () {
          codigoEstado.textContent = 'Invitación lista para enviar por ' + btn.getAttribute('data-canal') +
            ': «Únete a nuestro plan familiar en SismoListo con el código ' + codigo.textContent + '».';
        });
      });
    }

    // 3. Interactividad específica del Paso 5: Selección de Integrantes para Asignación de Roles (HU-007)
    var integranteItems = seccionConfig.querySelectorAll('.integrante-item');
    var inputRolAsignado = seccionConfig.querySelector('#rol-predefinido');

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
          seccionConfig.querySelector('#rol-etiqueta').textContent = 'Rol para ' + item.querySelector('strong').textContent + ':';
          inputRolAsignado.setAttribute('data-integrante', item.querySelector('strong').textContent);
          inputRolAsignado.focus();
        }
      });
    });
  }
})();

/* =====================================================================
   HU-008 — Acciones según la ubicación del integrante (Paso 6)
   ===================================================================== */
(function () {
  var select = document.getElementById('hu8-integrante');
  if (!select) { return; }

  var MAX = 120;
  var casa = document.getElementById('hu8-casa');
  var fuera = document.getElementById('hu8-fuera');
  var estado = document.getElementById('hu8-estado');
  var ficha = document.getElementById('hu8-ficha');
  var pendientes = document.getElementById('hu8-pendientes');

  /* Datos del hogar de ejemplo, los mismos de los mockups (WF-04). */
  var integrantes = {
    rosa: { nombre: 'Rosa Huamán', casa: 'Acompaño a Elena al punto de encuentro y reviso que todos hayan salido de la casa.', fuera: 'Reporto mi estado en la app y llamo a Elena.' },
    carlos: { nombre: 'Carlos Huamán', casa: 'Llevo la mochila de emergencia al punto de encuentro.', fuera: 'Voy al punto de encuentro y reporto mi estado en la app.' },
    elena: { nombre: 'Elena Huamán', casa: 'Me quedo junto a la columna de la sala hasta que llegue Rosa.', fuera: '' },
    mateo: { nombre: 'Mateo Huamán', casa: '', fuera: '' }
  };

  function contar(campo, idContador) {
    document.getElementById(idContador).textContent = campo.value.length + ' de ' + MAX + ' caracteres';
  }

  function cargar() {
    var i = integrantes[select.value];
    casa.value = i.casa;
    fuera.value = i.fuera;
    contar(casa, 'hu8-cont-casa');
    contar(fuera, 'hu8-cont-fuera');
    estado.textContent = '';
    pintarFicha();
  }

  /* CA03: la ficha del integrante muestra las dos acciones. */
  function pintarFicha() {
    var i = integrantes[select.value];
    ficha.innerHTML = '';
    var titulo = document.createElement('p');
    titulo.className = 'hu8-ficha-titulo';
    titulo.textContent = 'Ficha de ' + i.nombre;
    ficha.appendChild(titulo);
    [['Si está en casa', i.casa], ['Si está fuera', i.fuera]].forEach(function (par) {
      var p = document.createElement('p');
      var b = document.createElement('strong');
      b.textContent = par[0] + ': ';
      p.appendChild(b);
      p.appendChild(document.createTextNode(par[1] || 'Sin definir'));
      ficha.appendChild(p);
    });
  }

  /* CA04: lista de integrantes con alguna acción pendiente. */
  function pintarPendientes() {
    pendientes.innerHTML = '';
    Object.keys(integrantes).forEach(function (clave) {
      var i = integrantes[clave];
      var falta = [];
      if (!i.casa) { falta.push('«si está en casa»'); }
      if (!i.fuera) { falta.push('«si está fuera»'); }
      if (falta.length) {
        var li = document.createElement('li');
        li.textContent = i.nombre + ' todavía no tiene acciones para ' + falta.join(' ni ') + '.';
        pendientes.appendChild(li);
      }
    });
    if (!pendientes.children.length) {
      var ok = document.createElement('li');
      ok.textContent = 'Todos los integrantes tienen sus acciones definidas.';
      pendientes.appendChild(ok);
    }
  }

  /* CA01 y CA02: se guardan ambas acciones, con un máximo de 120 caracteres. */
  document.getElementById('hu8-guardar').addEventListener('click', function () {
    var i = integrantes[select.value];
    i.casa = casa.value.trim().slice(0, MAX);
    i.fuera = fuera.value.trim().slice(0, MAX);
    estado.textContent = 'Se guardaron las acciones de ' + i.nombre + '.';
    pintarFicha();
    pintarPendientes();
  });

  casa.addEventListener('input', function () { contar(casa, 'hu8-cont-casa'); });
  fuera.addEventListener('input', function () { contar(fuera, 'hu8-cont-fuera'); });
  select.addEventListener('change', cargar);

  cargar();
  pintarPendientes();
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

    // 5. Estado del hogar (Paso 5): HU-028, HU-033, HU-034 y HU-035
    var paso5 = seccionEmergencia.querySelector('#emergencia-step-5');
    var listaSinReporte = seccionEmergencia.querySelector('#lista-sin-reporte');
    var listaReportados = seccionEmergencia.querySelector('#lista-reportados');
    var contadorEstado = seccionEmergencia.querySelector('#estado-contador');
    var tiempoSismo = seccionEmergencia.querySelector('#estado-tiempo-sismo');
    var push = seccionEmergencia.querySelector('#push-integrante');
    var pushTexto = seccionEmergencia.querySelector('#push-integrante-texto');
    var btnVerFicha = seccionEmergencia.querySelector('#push-ver-ficha');
    var btnSimular = seccionEmergencia.querySelector('#btn-simular-reporte');
    var sinResultados = seccionEmergencia.querySelector('#estado-sin-resultados');
    var filtros = seccionEmergencia.querySelectorAll('.filtro-estado');
    var btnContactarPendiente = seccionEmergencia.querySelector('.btn-contactar-pendiente');
    var htmlInicialSinReporte = listaSinReporte ? listaSinReporte.innerHTML : '';
    var htmlInicialReportados = listaReportados ? listaReportados.innerHTML : '';
    var filtroActual = 'todos';
    var fichaNotificada = null;

    // El sismo de la demostración ocurrió hace 12 minutos.
    var horaSismo = new Date(Date.now() - 12 * 60 * 1000);
    var MINUTOS_REPORTE = { 'ficha-rosa': 2, 'ficha-elena': 3, 'ficha-carlos': 5 };

    var BADGES = {
      'bien': { clase: 'badge-bien', icono: 'check', texto: 'Estoy bien' },
      'ayuda': { clase: 'badge-ayuda', icono: 'warning', texto: 'Necesito ayuda' }
    };

    function horaTexto(fecha) {
      return String(fecha.getHours()).padStart(2, '0') + ':' + String(fecha.getMinutes()).padStart(2, '0');
    }

    function minutosDesdeSismo() {
      return Math.max(0, Math.floor((Date.now() - horaSismo.getTime()) / 60000));
    }

    // HU-033 CA02: hora del último reporte de cada integrante
    function pintarHorasIniciales() {
      Object.keys(MINUTOS_REPORTE).forEach(function (id) {
        var ficha = seccionEmergencia.querySelector('#' + id + ' .integrante-hora');
        if (ficha) {
          ficha.textContent = 'Reportó a las ' + horaTexto(new Date(horaSismo.getTime() + MINUTOS_REPORTE[id] * 60000));
        }
      });
    }

    // HU-028 CA03, HU-035 CA02 y CA04: contador y tiempo sin reporte
    function actualizarResumen() {
      if (!listaSinReporte) { return; }
      var total = seccionEmergencia.querySelectorAll('#emergencia-step-5 .integrante-estado-item').length;
      var pendientes = listaSinReporte.querySelectorAll('.integrante-estado-item');
      contadorEstado.innerHTML = '<strong>' + (total - pendientes.length) + ' de ' + total + '</strong> integrantes reportaron';
      tiempoSismo.textContent = minutosDesdeSismo() + ' min';
      pendientes.forEach(function (ficha) {
        ficha.querySelector('.integrante-hora').textContent =
          'Sin reporte desde hace ' + minutosDesdeSismo() + ' min';
      });
      if (btnContactarPendiente) {
        var texto = btnContactarPendiente.querySelector('.texto-contactar');
        texto.textContent = pendientes.length
          ? 'Enviar mensaje a ' + pendientes[0].getAttribute('data-nombre') + ' (sin reporte)'
          : 'Todos reportaron · continuar';
      }
      if (btnSimular) { btnSimular.hidden = pendientes.length === 0; }
      aplicarFiltro();
    }

    // HU-033 CA03: filtrar la lista por estado
    function aplicarFiltro() {
      var visibles = 0;
      seccionEmergencia.querySelectorAll('#emergencia-step-5 .integrante-estado-item').forEach(function (ficha) {
        var mostrar = filtroActual === 'todos' || ficha.getAttribute('data-estado') === filtroActual;
        ficha.hidden = !mostrar;
        if (mostrar) { visibles++; }
      });
      [listaSinReporte, listaReportados].forEach(function (lista) {
        var hayVisibles = lista.querySelector('.integrante-estado-item:not([hidden])');
        var titulo = seccionEmergencia.querySelector('#' + lista.getAttribute('aria-labelledby'));
        lista.hidden = !hayVisibles;
        titulo.hidden = !hayVisibles;
      });
      sinResultados.hidden = visibles > 0;
    }

    filtros.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filtroActual = btn.getAttribute('data-filtro');
        filtros.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
        aplicarFiltro();
      });
    });

    // Pasa una ficha de "Aún sin reporte" a "Ya reportaron" con su nuevo estado.
    function registrarReporte(ficha, estado, manual) {
      var badge = BADGES[estado];
      ficha.setAttribute('data-estado', estado);
      var actual = ficha.querySelector('.badge-estado');
      actual.className = 'badge-estado ' + badge.clase;
      actual.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">' + badge.icono +
        '</span> ' + badge.texto;
      ficha.querySelector('.integrante-hora').textContent = (manual ? 'Marcado por ti a las ' : 'Reportó a las ') +
        horaTexto(new Date());
      var marcar = ficha.querySelector('.marcar-manual');
      if (marcar) { marcar.remove(); }
      listaReportados.appendChild(ficha);
      actualizarResumen(); // HU-033 CA04 y HU-035 CA04: la lista se actualiza sola
    }

    // HU-028 CA02: marcar a mano a quien no puede reportar
    if (listaSinReporte) {
      listaSinReporte.addEventListener('click', function (e) {
        var btn = e.target.closest('.btn-marcar-manual');
        if (!btn) { return; }
        registrarReporte(btn.closest('.integrante-estado-item'), btn.getAttribute('data-marcar'), true);
      });
    }

    // HU-034 CA01-CA02: llega el reporte y aparece la notificación con nombre y estado
    if (btnSimular) {
      btnSimular.addEventListener('click', function () {
        var ficha = listaSinReporte.querySelector('.integrante-estado-item');
        if (!ficha) { return; }
        var nombre = ficha.getAttribute('data-nombre');
        registrarReporte(ficha, 'bien', false);
        fichaNotificada = ficha;
        pushTexto.textContent = nombre + ' reportó: Estoy bien (' + horaTexto(new Date()) + ').';
        push.hidden = false;
        btnSimular.hidden = true;
      });
    }

    // HU-034 CA03: la notificación abre la ficha del integrante
    if (btnVerFicha) {
      btnVerFicha.addEventListener('click', function () {
        if (!fichaNotificada) { return; }
        filtros[0].click();
        push.hidden = true;
        fichaNotificada.classList.add('integrante-destacado');
        fichaNotificada.scrollIntoView({ behavior: 'smooth', block: 'center' });
        fichaNotificada.focus({ preventScroll: true });
      });
    }

    function reiniciarEstadoHogar() {
      if (!listaSinReporte) { return; }
      listaSinReporte.innerHTML = htmlInicialSinReporte;
      listaReportados.innerHTML = htmlInicialReportados;
      push.hidden = true;
      btnSimular.hidden = false;
      fichaNotificada = null;
      filtroActual = 'todos';
      filtros.forEach(function (b, i) { b.setAttribute('aria-pressed', String(i === 0)); });
      pintarHorasIniciales();
      actualizarResumen();
    }

    if (paso5) {
      pintarHorasIniciales();
      actualizarResumen();
      setInterval(actualizarResumen, 30000);
    }

    // Botón para contactar a integrante pendiente en Paso 5 -> Paso 6
    // (si ya reportaron todos, se pasa directo a "Después del sismo")
    if (btnContactarPendiente) {
      btnContactarPendiente.addEventListener('click', function () {
        var hayPendientes = listaSinReporte && listaSinReporte.querySelector('.integrante-estado-item');
        mostrarPasoEmergencia(hayPendientes ? 'emergencia-step-6' : 'emergencia-step-7');
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
        reiniciarEstadoHogar();
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
        el.setAttribute('aria-selected', String(i === indice));
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

    // HU-005 — Integrantes que requieren asistencia
    seccionAccesibilidad.querySelectorAll('.acc-miembro').forEach(function (miembro) {
      var requiere = miembro.querySelector('.acc-requiere');
      var tipo = miembro.querySelector('.acc-tipo');
      var responsable = miembro.querySelector('.acc-responsable');
      var campos = miembro.querySelector('.acc-campos');
      var estadoMiembro = miembro.querySelector('.acc-miembro-estado');

      function pintarMiembro() {
        campos.hidden = !requiere.checked;
        if (!requiere.checked) {
          estadoMiembro.innerHTML = '<span class="acc-etiqueta">No requiere asistencia</span>';
          return;
        }
        // CA03: ícono + texto, nunca solo color
        var html = '<span class="acc-etiqueta"><span class="material-symbols-outlined" aria-hidden="true">accessible</span>Requiere asistencia: ' +
          tipo.value.toLowerCase() + '</span> ';
        // CA04: advertencia si no tiene responsable
        html += responsable.value
          ? '<span class="acc-etiqueta acc-etiqueta-ok"><span class="material-symbols-outlined" aria-hidden="true">check</span>Responsable: ' + responsable.value.toLowerCase() + '</span>'
          : '<span class="acc-etiqueta acc-etiqueta-alerta"><span class="material-symbols-outlined" aria-hidden="true">warning</span>Sin responsable asignado</span>';
        estadoMiembro.innerHTML = html;
      }
      [requiere, tipo, responsable].forEach(function (campo) { campo.addEventListener('change', pintarMiembro); });
      pintarMiembro();
    });

    // HU-011 — Contactos de emergencia externos (máximo 5, celular de 9 dígitos, guardados en el dispositivo)
    var formContacto = seccionAccesibilidad.querySelector('#acc-form-contacto');
    if (formContacto) {
      var CLAVE_CONTACTOS = 'sismolisto-hu011-contactos-v1';
      var MAX_CONTACTOS = 5;
      var listaContactos = seccionAccesibilidad.querySelector('#acc-contactos');
      var contadorContactos = seccionAccesibilidad.querySelector('#acc-contactos-contador');
      var errorContacto = seccionAccesibilidad.querySelector('#acc-c-error');
      var contactos = [
        { nombre: 'Julio Cárdenas', celular: '987654321', relacion: 'Hermano' },
        { nombre: 'Mercedes Ríos', celular: '912345678', relacion: 'Vecina' }
      ];
      try {
        var guardados = JSON.parse(window.localStorage.getItem(CLAVE_CONTACTOS));
        if (Array.isArray(guardados)) { contactos = guardados; }
      } catch (e) { /* sin almacenamiento: se usan los contactos de ejemplo */ }

      function guardarContactos() {
        try { window.localStorage.setItem(CLAVE_CONTACTOS, JSON.stringify(contactos)); } catch (e) { }
      }

      function pintarContactos() {
        listaContactos.innerHTML = '';
        contactos.forEach(function (c, i) {
          var li = document.createElement('li');
          li.className = 'acc-item acc-contacto';
          var datos = document.createElement('div');
          var nombre = document.createElement('strong');
          nombre.textContent = c.nombre;
          var detalle = document.createElement('p');
          detalle.textContent = c.relacion + ' · ' + c.celular.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
          datos.appendChild(nombre);
          datos.appendChild(detalle);
          var quitar = document.createElement('button');
          quitar.type = 'button';
          quitar.className = 'acc-quitar';
          quitar.textContent = 'Quitar';
          quitar.setAttribute('aria-label', 'Quitar a ' + c.nombre);
          quitar.addEventListener('click', function () {
            contactos.splice(i, 1);
            guardarContactos();
            pintarContactos();
          });
          li.appendChild(datos);
          li.appendChild(quitar);
          listaContactos.appendChild(li);
        });
        var lleno = contactos.length >= MAX_CONTACTOS;
        contadorContactos.textContent = contactos.length + ' de ' + MAX_CONTACTOS + ' contactos guardados' +
          (lleno ? '. Llegaste al máximo: quita uno para agregar otro.' : '.');
        formContacto.hidden = lleno;
      }

      formContacto.addEventListener('submit', function (e) {
        e.preventDefault();
        var campoNombre = formContacto.querySelector('#acc-c-nombre');
        var campoCel = formContacto.querySelector('#acc-c-celular');
        var nombre = campoNombre.value.trim();
        var celular = campoCel.value.replace(/\s+/g, '');
        campoNombre.removeAttribute('aria-invalid');
        campoCel.removeAttribute('aria-invalid');
        if (nombre.length < 2) {
          errorContacto.textContent = 'Escribe el nombre del contacto.';
          campoNombre.setAttribute('aria-invalid', 'true');
          campoNombre.focus();
          return;
        }
        if (!/^9\d{8}$/.test(celular)) {
          errorContacto.textContent = 'El celular debe tener 9 dígitos y empezar con 9. Ejemplo: 987654321.';
          campoCel.setAttribute('aria-invalid', 'true');
          campoCel.focus();
          return;
        }
        errorContacto.textContent = '';
        contactos.push({ nombre: nombre, celular: celular, relacion: formContacto.querySelector('#acc-c-relacion').value });
        guardarContactos();
        formContacto.reset();
        pintarContactos();
      });

      pintarContactos();
    }

    // HU-013 — Progreso del plan familiar
    var pendientes = seccionAccesibilidad.querySelectorAll('#acc-pendientes .acc-item');
    if (pendientes.length) {
      var SECCIONES_TOTALES = 6;
      var SECCIONES_HECHAS = 3;
      var barraAvance = seccionAccesibilidad.querySelector('#acc-barra-avance');
      var barra = barraAvance.parentElement;
      var textoPorcentaje = seccionAccesibilidad.querySelector('#acc-porcentaje');
      var planCompleto = seccionAccesibilidad.querySelector('#acc-plan-completo');

      function pintarProgreso() {
        var hechas = SECCIONES_HECHAS + seccionAccesibilidad.querySelectorAll('#acc-pendientes .acc-hecho:checked').length;
        var porcentaje = Math.round(hechas * 100 / SECCIONES_TOTALES);
        barraAvance.style.width = porcentaje + '%';
        barra.setAttribute('aria-valuenow', String(porcentaje));
        textoPorcentaje.textContent = porcentaje + ' % completado (' + hechas + ' de ' + SECCIONES_TOTALES + ' secciones)';
        pendientes.forEach(function (p) {
          p.classList.toggle('acc-item-hecho', p.querySelector('.acc-hecho').checked);
        });
        // CA04: al completar todo, el plan queda "Completo" con la fecha
        if (hechas === SECCIONES_TOTALES) {
          var hoy = new Date();
          planCompleto.textContent = 'Plan Completo · registrado el ' + String(hoy.getDate()).padStart(2, '0') + '/' +
            String(hoy.getMonth() + 1).padStart(2, '0') + '/' + hoy.getFullYear();
          planCompleto.hidden = false;
        } else {
          planCompleto.hidden = true;
        }
      }

      seccionAccesibilidad.querySelectorAll('#acc-pendientes .acc-hecho').forEach(function (c) {
        c.addEventListener('change', pintarProgreso);
      });

      // CA03: cada pendiente lleva directo a la pantalla donde se completa
      seccionAccesibilidad.querySelectorAll('.acc-ir').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var destino;
          if (btn.getAttribute('data-ir') === 'mochila') {
            destino = document.getElementById('hu15-panel');
          } else {
            var indice = Number(btn.getAttribute('data-paso'));
            var pasosConfig = document.querySelectorAll('#seccion-configuracioninicial-gestionhogar .pasos-barra .paso-item');
            if (pasosConfig[indice]) { pasosConfig[indice].click(); }
            destino = document.getElementById('seccion-configuracioninicial-gestionhogar');
          }
          if (destino) { destino.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        });
      });

      pintarProgreso();
    }

    // HU-032 — Modo de ahorro de batería (activar o desactivar en cualquier momento)
    var btnAhorro = seccionAccesibilidad.querySelector('#acc-ahorro');
    if (btnAhorro) {
      btnAhorro.addEventListener('click', function () {
        var activo = btnAhorro.getAttribute('aria-pressed') !== 'true';
        btnAhorro.setAttribute('aria-pressed', String(activo));
        seccionAccesibilidad.querySelector('#acc-ahorro-estado').textContent = activo ? 'Activado' : 'Desactivado';
        seccionAccesibilidad.querySelector('#acc-ahorro-detalle').hidden = !activo;
        seccionAccesibilidad.querySelector('#acc-ahorro-apagado').hidden = activo;
        seccionAccesibilidad.querySelector('#acc-bateria').classList.toggle('acc-bateria-activa', activo);
      });
      seccionAccesibilidad.querySelector('#acc-bateria').classList.add('acc-bateria-activa');
    }

    // Mostrar el badge de "Imagen compartida con éxito" al hacer clic en el botón de compartir como imagen
    // (selector acotado a la función 3 para que otros botones no lo reemplacen)
    var btnCompartirImagen = seccionAccesibilidad.querySelector('#acc-3 .btn-enviar');
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

// =========================================================
// MENÚ DESPLEGABLE SUPERIOR Y CONTROLES DE ACCESIBILIDAD
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
    const btnNavToggle = document.getElementById("btn-nav-acc-toggle");
    const menuNavAcc = document.getElementById("menu-nav-acc");

    // 1. Abrir y cerrar la barra desplegable de arriba
    if (btnNavToggle && menuNavAcc) {
        btnNavToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            const abierto = btnNavToggle.getAttribute("aria-expanded") === "true";
            btnNavToggle.setAttribute("aria-expanded", String(!abierto));
            menuNavAcc.hidden = abierto;
        });

        // Cerrar si se hace clic fuera del menú
        document.addEventListener("click", (e) => {
            if (!menuNavAcc.hidden && !menuNavAcc.contains(e.target) && !btnNavToggle.contains(e.target)) {
                btnNavToggle.setAttribute("aria-expanded", "false");
                menuNavAcc.hidden = true;
            }
        });
    }

    // 2. Hacer que funcionen tanto los botones de arriba como los de la Sección 4
    const botonesAmpliado = document.querySelectorAll(".js-acc-ampliado, #btn-acc-ampliado");
    const botonesContraste = document.querySelectorAll(".js-acc-contraste, #btn-acc-contraste");
    const botonesNormal = document.querySelectorAll(".js-acc-normal, #btn-acc-normal");

    let textoGrandeActivo = false;

    botonesAmpliado.forEach((btn) => {
        btn.addEventListener("click", () => {
            textoGrandeActivo = !textoGrandeActivo;
            document.documentElement.style.fontSize = textoGrandeActivo ? "120%" : "100%";
            botonesAmpliado.forEach((b) => b.setAttribute("aria-pressed", String(textoGrandeActivo)));
        });
    });

    botonesContraste.forEach((btn) => {
        btn.addEventListener("click", () => {
            const contrasteActivo = document.body.classList.toggle("modo-alto-contraste");
            botonesContraste.forEach((b) => b.setAttribute("aria-pressed", String(contrasteActivo)));
        });
    });

    botonesNormal.forEach((btn) => {
        btn.addEventListener("click", () => {
            textoGrandeActivo = false;
            document.documentElement.style.fontSize = "100%";
            document.body.classList.remove("modo-alto-contraste");
            botonesAmpliado.forEach((b) => b.setAttribute("aria-pressed", "false"));
            botonesContraste.forEach((b) => b.setAttribute("aria-pressed", "false"));
        });
    });
});

/* =====================================================================
   Criterios de aceptación completados para las pruebas del capítulo VI
   HU-004, HU-007, HU-009, HU-010, HU-022, HU-025, HU-029, HU-030, HU-036
   ===================================================================== */
(function () {
  function hora() {
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* ---------- HU-004: integrantes ---------- */
  var listaInt = document.getElementById('int-lista');
  var formInt = document.getElementById('form-integrantes');
  if (listaInt && formInt) {
    var integrantes = [
      { nombre: 'Rosa Huamán', parentesco: 'Madre', edad: '18 a 59 años', celular: '987654321' },
      { nombre: 'Carlos Huamán', parentesco: 'Padre', edad: '18 a 59 años', celular: '955123456' },
      { nombre: 'Elena Huamán', parentesco: 'Abuela', edad: '60 años o más', celular: '' },
      { nombre: 'Mateo Huamán', parentesco: 'Hijo', edad: '12 a 17 años', celular: '934567812' }
    ];
    var editando = -1;
    var error = document.getElementById('int-error');
    var boton = document.getElementById('int-guardar');
    var campos = {
      nombre: document.getElementById('int-nombre'),
      parentesco: document.getElementById('parentesco'),
      edad: document.getElementById('edad'),
      celular: document.getElementById('int-celular')
    };

    function pintar() {
      listaInt.innerHTML = '';
      integrantes.forEach(function (i, k) {
        var li = document.createElement('li');
        li.className = 'int-item';
        var datos = document.createElement('div');
        datos.innerHTML = '<strong></strong><span></span>';
        datos.querySelector('strong').textContent = i.nombre;
        datos.querySelector('span').textContent = i.parentesco + ' · ' + i.edad;
        var cel = document.createElement('span');
        cel.className = 'acc-etiqueta int-celular';
        cel.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">' +
          (i.celular ? 'smartphone' : 'mobile_off') + '</span>' + (i.celular ? 'Con celular' : 'Sin celular');
        var acciones = document.createElement('div');
        acciones.className = 'int-acciones';
        [['Editar', function () { cargar(k); }], ['Quitar', function () { quitar(k); }]].forEach(function (a) {
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'push-ver-ficha'; b.textContent = a[0];
          b.setAttribute('aria-label', a[0] + ' a ' + i.nombre);
          b.addEventListener('click', a[1]);
          acciones.appendChild(b);
        });
        li.appendChild(datos); li.appendChild(cel); li.appendChild(acciones);
        listaInt.appendChild(li);
      });
    }
    function cargar(k) {
      editando = k;
      var i = integrantes[k];
      campos.nombre.value = i.nombre; campos.parentesco.value = i.parentesco;
      campos.edad.value = i.edad; campos.celular.value = i.celular;
      boton.textContent = 'Guardar cambios';
      campos.nombre.focus();
    }
    function quitar(k) {
      var nombre = integrantes[k].nombre;
      integrantes.splice(k, 1);
      editando = -1; formInt.reset(); boton.textContent = 'Agregar integrante';
      error.textContent = 'Se quitó a ' + nombre + ' de la lista.';
      pintar();
    }
    formInt.addEventListener('submit', function (e) {
      e.preventDefault();
      var celular = campos.celular.value.replace(/\s+/g, '');
      if (!campos.nombre.value.trim() || !campos.parentesco.value.trim() || !campos.edad.value) {
        error.textContent = 'Completa el nombre, el parentesco y el rango de edad.';
        return;
      }
      if (celular && !/^9\d{8}$/.test(celular)) {
        error.textContent = 'El celular debe tener 9 dígitos y empezar con 9, o dejarse vacío.';
        campos.celular.focus();
        return;
      }
      var dato = { nombre: campos.nombre.value.trim(), parentesco: campos.parentesco.value.trim(), edad: campos.edad.value, celular: celular };
      if (editando >= 0) { integrantes[editando] = dato; error.textContent = 'Se actualizaron los datos de ' + dato.nombre + '.'; }
      else { integrantes.push(dato); error.textContent = 'Se agregó a ' + dato.nombre + '.'; }
      editando = -1; formInt.reset(); boton.textContent = 'Agregar integrante';
      pintar();
    });
    pintar();
  }

  /* ---------- HU-007: roles ---------- */
  var rolSelect = document.getElementById('rol-predefinido');
  if (rolSelect) {
    var rolInput = document.getElementById('rol-emergencia-input');
    var rolError = document.getElementById('rol-error');
    var rolAviso = document.getElementById('rol-aviso');
    var rolesLista = document.getElementById('roles-lista');
    var roles = [
      { rol: 'Llevar la mochila', responsable: 'Carlos Huamán' },
      { rol: 'Cortar luz y gas', responsable: 'Mateo Huamán' },
      { rol: 'Asistir a Elena', responsable: 'Rosa Huamán' }
    ];
    function pintarRoles() {
      rolesLista.innerHTML = '';
      roles.forEach(function (r) {
        var li = document.createElement('li');
        li.innerHTML = '<strong></strong>: ';
        li.querySelector('strong').textContent = r.rol;
        li.appendChild(document.createTextNode(r.responsable));
        rolesLista.appendChild(li);
      });
    }
    rolSelect.addEventListener('change', function () {
      var personal = rolSelect.value === 'personalizado';
      document.querySelectorAll('.rol-personalizado').forEach(function (el) { el.hidden = !personal; });
      if (personal) { rolInput.focus(); }
    });
    document.getElementById('rol-asignar').addEventListener('click', function () {
      var integrante = rolSelect.getAttribute('data-integrante');
      if (!integrante) { rolError.textContent = 'Primero elige a un integrante de la lista.'; return; }
      var nombreRol = rolSelect.value === 'personalizado' ? rolInput.value.trim() : rolSelect.value;
      if (!nombreRol) { rolError.textContent = 'Escribe el nombre del rol personalizado.'; rolInput.focus(); return; }
      rolError.textContent = '';
      var existente = roles.filter(function (r) { return r.rol === nombreRol; })[0];
      if (existente) { existente.responsable = integrante; } else { roles.push({ rol: nombreRol, responsable: integrante }); }
      rolAviso.textContent = 'Se notificó a ' + integrante + ' su rol: «' + nombreRol + '».';
      pintarRoles();
    });
    pintarRoles();
  }

  /* ---------- HU-009: marcar en el mapa y avisar del cambio ---------- */
  var mapa = document.getElementById('mapa-encuentro');
  if (mapa) {
    var pin = mapa.querySelector('.pin-ubicacion');
    function marcar(x, y) {
      pin.style.left = x + '%'; pin.style.top = y + '%';
      document.getElementById('mapa-estado').textContent = 'Ubicación marcada en el mapa. Se guarda en tu celular para verla sin internet.';
    }
    mapa.addEventListener('click', function (e) {
      var r = mapa.getBoundingClientRect();
      marcar(Math.round((e.clientX - r.left) * 100 / r.width), Math.round((e.clientY - r.top) * 100 / r.height));
    });
    mapa.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); marcar(50, 50); }
    });
  }
  var botonEncuentro = document.querySelector('#form-encuentro .btn-enviar');
  if (botonEncuentro) {
    botonEncuentro.addEventListener('click', function () {
      var form = document.getElementById('form-encuentro');
      if (!form.checkValidity()) { return; }
      document.getElementById('resumen-encuentro').textContent = document.getElementById('encuentro-nombre').value.trim();
      document.getElementById('resumen-aviso').textContent = 'Se avisó del nuevo punto de encuentro a los integrantes vinculados.';
    });
  }
  var botonZona = document.querySelector('#form-zonas .btn-enviar');
  if (botonZona) {
    botonZona.addEventListener('click', function () {
      var form = document.getElementById('form-zonas');
      if (!form.checkValidity()) { return; }
      var zona = document.getElementById('zona-desc').value.trim();
      document.getElementById('resumen-zona').textContent = zona;
      var asignada = document.getElementById('zona-asignada').value;
      document.getElementById('resumen-ficha-elena').hidden = asignada.indexOf('Elena') !== 0;
      document.getElementById('resumen-zona-elena').textContent = zona;
    });
  }

  /* ---------- Modo Emergencia ---------- */
  var seccion = document.getElementById('seccion-emergencia-respuestainmediata');
  if (!seccion) { return; }
  var confirmar = document.getElementById('confirmar-emergencia');
  var btnActivar = seccion.querySelector('.btn-emergencia-activar');
  // HU-025 CA03: el botón abre una confirmación; el paso 2 se muestra solo al confirmar
  btnActivar.addEventListener('click', function (e) {
    e.stopImmediatePropagation();
    confirmar.hidden = false;
    document.getElementById('btn-confirmar-emergencia').focus();
  }, true);
  document.getElementById('btn-cancelar-emergencia').addEventListener('click', function () {
    confirmar.hidden = true; btnActivar.focus();
  });
  document.getElementById('btn-confirmar-emergencia').addEventListener('click', function () {
    confirmar.hidden = true;
    // HU-025 CA04: se registra la fecha y la hora de la activación
    var d = new Date();
    document.getElementById('emergencia-activado').textContent = 'Modo Emergencia activado el ' +
      String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear() + ' a las ' + hora() + '.';
    seccion.querySelectorAll('.hu-zone-container > .step-emergencia').forEach(function (p) {
      p.classList.toggle('active', p.id === 'emergencia-step-2');
    });
  });

  var confirmacion = document.getElementById('confirmacion-reporte');
  function fichaRosa(estado, texto, horaTexto) {
    var ficha = document.getElementById('ficha-rosa');
    if (!ficha) { return; }
    var BADGES = { bien: ['badge-bien', 'check', 'Estoy bien'], ayuda: ['badge-ayuda', 'sos', 'Necesito ayuda'] };
    var b = BADGES[estado];
    ficha.setAttribute('data-estado', estado);
    ficha.querySelector('.badge-estado').className = 'badge-estado ' + b[0];
    ficha.querySelector('.badge-estado').innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">' + b[1] + '</span> ' + b[2];
    ficha.querySelector('.integrante-hora').textContent = texto + horaTexto;
  }
  // HU-029 CA02 y CA03: aviso a los integrantes y hora del reporte
  seccion.querySelector('.btn-estoy-bien').addEventListener('click', function () {
    var h = hora();
    confirmacion.textContent = 'Tu reporte «Estoy bien» se envió a Carlos, Elena y Mateo a las ' + h + '.';
    confirmacion.className = 'confirmacion-reporte confirmacion-reporte--bien';
    confirmacion.hidden = false;
    fichaRosa('bien', 'Reportó a las ', h);
  });
  // HU-030 CA03 y CA04: prioridad alta al responsable y confirmación visual
  var formAyuda = document.getElementById('form-solicitud-ayuda');
  formAyuda.addEventListener('submit', function () {
    var sel = document.getElementById('tipo-ayuda');
    var tipo = sel.value ? sel.options[sel.selectedIndex].text : 'sin especificar';
    var h = hora();
    confirmacion.textContent = 'Tu pedido de ayuda (' + tipo.toLowerCase() + ') se envió con prioridad alta a Carlos Huamán, tu responsable, y a los demás integrantes, a las ' + h + '.';
    confirmacion.className = 'confirmacion-reporte confirmacion-reporte--ayuda';
    confirmacion.hidden = false;
    fichaRosa('ayuda', 'Pidió ayuda a las ', h);
  });
  // HU-036 CA01: contacto directo desde la ficha del integrante sin reporte
  seccion.addEventListener('click', function (e) {
    if (e.target.closest('.btn-contactar-ficha')) {
      seccion.querySelector('.btn-contactar-pendiente').click();
    }
  });
  // HU-036 CA03: el intento de contacto queda registrado
  document.getElementById('form-mensaje-rapido').addEventListener('submit', function () {
    document.getElementById('mensaje-confirmacion').innerHTML =
      '<span class="material-symbols-outlined icono-en-linea" aria-hidden="true">check_circle</span> Mensaje enviado a Mateo Huamán por SMS a las ' +
      hora() + '. El intento de contacto quedó registrado en el historial del plan.';
  });
  // Al cerrar el Modo Emergencia, la confirmación se oculta
  var cerrar = seccion.querySelector('#emergencia-step-7 .btn-enviar');
  cerrar.addEventListener('click', function () {
    confirmacion.hidden = true;
    document.getElementById('emergencia-activado').textContent = '';
  });
})();
