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
      return { clave: 'sin-fecha', texto: 'Sin vencimiento', icono: 'remove' };
    }
    var partes = iso.split('-');
    var fecha = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
    fecha.setHours(0, 0, 0, 0);
    var dias = Math.round((fecha - hoySinHora()) / MS_DIA);

    if (dias < 0) {
      return { clave: 'vencido', texto: 'Vencido', icono: 'error', dias: dias };
    }
    if (dias <= DIAS_AVISO_VENCIMIENTO) {
      return { clave: 'por-vencer', texto: 'Por vencer', icono: 'schedule', dias: dias };
    }
    return { clave: 'vigente', texto: 'Vigente', icono: 'check_circle', dias: dias };
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
          icono: 'water_drop',
          vence: aISO(sumarDias(180)),
          origen: 'Calculada para ' + integrantes + (integrantes === 1 ? ' integrante' : ' integrantes')
        },
        {
          nombre: 'Medicamentos de uso diario',
          cantidad: '1 bolsa',
          icono: 'medication',
          vence: aISO(sumarDias(10)),
          origen: 'Lista base INDECI / UNICEF'
        },
        {
          nombre: 'Galletas y conservas',
          cantidad: integrantes * 3 + ' raciones',
          icono: 'cookie',
          vence: aISO(sumarDias(-6)),
          origen: 'Lista base INDECI / UNICEF'
        }
      ];

      if (checkAdultos.checked) {
        base.push({
          nombre: 'Medicamentos para adultos mayores',
          cantidad: '1 kit',
          icono: 'elderly',
          vence: aISO(sumarDias(45)),
          origen: 'Agregado porque el hogar tiene adultos mayores'
        });
      }
      if (checkNinos.checked) {
        base.push({
          nombre: 'Pañales y fórmula infantil',
          cantidad: '1 paquete',
          icono: 'child_care',
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

      var icono = document.createElement('span');
      icono.className = 'material-symbols-outlined hu15-item-icono';
      icono.setAttribute('aria-hidden', 'true');
      icono.textContent = articulo.icono;

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
      var badgeIcono = document.createElement('span');
      badgeIcono.className = 'material-symbols-outlined';
      badgeIcono.setAttribute('aria-hidden', 'true');
      badgeIcono.textContent = estado.icono;
      badge.appendChild(badgeIcono);
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
        quitar.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">close</span>';
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
        icono: 'inventory_2',
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
        iconoBoton.textContent = 'flag';
      } else {
        textoBoton.textContent = 'Siguiente paso';
        iconoBoton.textContent = 'arrow_forward';
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
      iconoBoton.textContent = 'replay';

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
      iconoBoton.textContent = 'play_arrow';

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
