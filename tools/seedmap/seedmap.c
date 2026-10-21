/* LeiaNET seedmap: envoltorio wasm sobre cubiomes (MIT, Cubitect). */
#include <stdlib.h>
#include <string.h>
#include "generator.h"
#include "finders.h"
#include "util.h"
#define EXPORT(n) __attribute__((export_name(n)))
static Generator g; static int g_mc, g_dim; static uint64_t g_seed;
static int outbuf[16384*2]; static unsigned char colors[256][3]; static unsigned char slime[64*64];
static int vers[] = {MC_1_16_5,MC_1_17_1,MC_1_18_2,MC_1_19_2,MC_1_19_4,MC_1_20_6,MC_1_21_1,MC_1_21_3,MC_1_21_WD};
EXPORT("sm_out") int *sm_out(void){ return outbuf; }
EXPORT("sm_colors") unsigned char *sm_colors(void){ initBiomeColors(colors); return &colors[0][0]; }
EXPORT("sm_slime_buf") unsigned char *sm_slime_buf(void){ return slime; }
EXPORT("sm_setup") void sm_setup(int vi, unsigned lo, unsigned hi, int dim){
  g_mc = vers[vi]; g_dim = dim; g_seed = ((uint64_t)hi<<32)|lo;
  setupGenerator(&g, g_mc, 0); applySeed(&g, dim, g_seed); }
/* bioma por celda: escala 'sc' (1,4,16,64,256), w*h <= 16384. Devuelve 0 ok. */
EXPORT("sm_tile") int sm_tile(int sc, int x, int z, int w, int h){
  if (w*h > 16384) return -1;
  Range r = {sc, x, z, w, h, (g_dim==0 ? (sc==1?63:15) : 0), 1};
  if (g_dim==0 && sc>4) r.y = 0;
  int *c = allocCache(&g, r); if (!c) return -2;
  int e = genBiomes(&g, c, r);
  if (!e) memcpy(outbuf, c, (size_t)w*h*4);
  free(c); return e; }
EXPORT("sm_biome_name") const char *sm_biome_name(int id){ return biome2str(g_mc, id); }
static const int types[] = {Desert_Pyramid,Jungle_Temple,Swamp_Hut,Igloo,Village,Ocean_Ruin,Shipwreck,Monument,Mansion,Outpost,Ruined_Portal,Ruined_Portal_N,Ancient_City,Treasure,Mineshaft,Desert_Well,Geode,Fortress,Bastion,End_City,End_Gateway,Trail_Ruins,Trial_Chambers};
EXPORT("sm_struct_count") int sm_struct_count(void){ return sizeof types/sizeof *types; }
/* estructuras en [x0,x1]x[z0,z1] (bloques). Devuelve cantidad, o -4 si el area es excesiva. */
EXPORT("sm_structures") int sm_structures(int ti, int x0, int z0, int x1, int z1, int viable){
  int t = types[ti]; StructureConfig sc; if (!getStructureConfig(t, g_mc, &sc)) return 0;
  if (sc.dim != g_dim) return 0;
  int rs = sc.regionSize * 16;
  int fx = x0 / rs - 1, tx = x1 / rs + 1, fz = z0 / rs - 1, tz = z1 / rs + 1;
  if ((long)(tx-fx+1)*(long)(tz-fz+1) > 60000L) return -4;
  int n = 0;
  for (int rz = fz; rz <= tz; rz++) for (int rx = fx; rx <= tx; rx++) {
    Pos p; if (!getStructurePos(t, g_mc, g_seed, rx, rz, &p)) continue;
    if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
    if (viable && !isViableStructurePos(t, &g, p.x, p.z, 0)) continue;
    if (n >= 16000) return n;
    outbuf[2*n] = p.x; outbuf[2*n+1] = p.z; n++; }
  return n; }
EXPORT("sm_strongholds") int sm_strongholds(int max){
  StrongholdIter sh; initFirstStronghold(&sh, g_mc, g_seed); int n = 0;
  while (n < max && nextStronghold(&sh, &g)) { outbuf[2*n]=sh.pos.x; outbuf[2*n+1]=sh.pos.z; n++; }
  return n; }
EXPORT("sm_spawn") void sm_spawn(void){ Pos p = getSpawn(&g); outbuf[0]=p.x; outbuf[1]=p.z; }
/* slime chunks: w*h <= 4096, origen en chunks */
EXPORT("sm_slime") void sm_slime(int cx, int cz, int w, int h){
  for (int j=0;j<h;j++) for (int i=0;i<w;i++) slime[j*w+i] = isSlimeChunk(g_seed, cx+i, cz+j); }
