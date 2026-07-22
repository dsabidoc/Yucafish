// Coordenadas terrestres consultadas el 22-07-2026 en OpenStreetMap/Nominatim.
// Yucalpetén usa la estación oficial SEMAR (21°16'39.67" N, 89°42'16.72" W).
// Los puntos marinos son desplazamientos públicos aproximados de 4–6 km mar adentro;
// no representan sitios privados de pesca y se combinan con cell_selection=sea.
export const yucatanPorts = [
  { name: "Progreso", slug: "progreso", municipality: "Progreso", latitude: 21.282214, longitude: -89.663664, marineLatitude: 21.326, marineLongitude: -89.6637 },
  { name: "Yucalpetén", slug: "yucalpeten", municipality: "Progreso", latitude: 21.277686, longitude: -89.704644, marineLatitude: 21.3215, marineLongitude: -89.7046 },
  { name: "Chicxulub Puerto", slug: "chicxulub-puerto", municipality: "Progreso", latitude: 21.29329, longitude: -89.60681, marineLatitude: 21.337, marineLongitude: -89.6068 },
  { name: "Chuburná Puerto", slug: "chuburna-puerto", municipality: "Progreso", latitude: 21.252449, longitude: -89.81578, marineLatitude: 21.296, marineLongitude: -89.8158 },
  { name: "Chelem", slug: "chelem", municipality: "Progreso", latitude: 21.268747, longitude: -89.742285, marineLatitude: 21.3125, marineLongitude: -89.7423 },
  { name: "Sisal", slug: "sisal", municipality: "Hunucmá", latitude: 21.16518, longitude: -90.03113, marineLatitude: 21.207, marineLongitude: -90.045 },
  { name: "Celestún", slug: "celestun", municipality: "Celestún", latitude: 20.922159, longitude: -90.298619, marineLatitude: 20.94, marineLongitude: -90.343 },
  { name: "Telchac Puerto", slug: "telchac-puerto", municipality: "Telchac Puerto", latitude: 21.308321, longitude: -89.273681, marineLatitude: 21.352, marineLongitude: -89.2737 },
  { name: "Dzilam de Bravo", slug: "dzilam-de-bravo", municipality: "Dzilam de Bravo", latitude: 21.440849, longitude: -88.625987, marineLatitude: 21.484, marineLongitude: -88.626 },
  { name: "San Felipe", slug: "san-felipe", municipality: "San Felipe", latitude: 21.494656, longitude: -88.297979, marineLatitude: 21.535, marineLongitude: -88.312 },
  { name: "Río Lagartos", slug: "rio-lagartos", municipality: "Río Lagartos", latitude: 21.520497, longitude: -88.133154, marineLatitude: 21.559, marineLongitude: -88.145 },
  { name: "El Cuyo", slug: "el-cuyo", municipality: "Tizimín", latitude: 21.516167, longitude: -87.677807, marineLatitude: 21.554, marineLongitude: -87.664 },
] as const;
