set -e
python3 splice_glb_v6.py v6.glb b71/parts_wm.glb t1.glb windmill_static_merged,windmill_sails meadow_palette_256=pal_v71.png meadow_ground_v0_8_1024=ground_v71.jpg meadow_sky_4096x1024=sky_v71.jpg
python3 append_nodes.py t1.glb b71/life_flowers.glb t2.glb -
python3 append_nodes.py t2.glb b71/life_butterflies.glb t3.glb meadow_butterflies_loop
python3 append_nodes.py t3.glb b71/life_birds.glb t4.glb meadow_birds_loop
python3 append_nodes.py t4.glb b71/life_flag.glb t5.glb windmill_flag_loop
python3 append_nodes.py t5.glb b71/life_contact.glb t6.glb -
python3 prune_glb.py t6.glb v71.glb; rm t?.glb; python3 fix_anim_t0.py v71.glb
