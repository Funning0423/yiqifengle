set -e
python3 splice_glb_v6.py v6.glb b7/parts_wm.glb t1.glb windmill_static_merged,windmill_sails meadow_palette_256=pal_v7.png meadow_ground_v0_8_1024=ground_v7.jpg
python3 append_nodes.py t1.glb b7/life_flowers.glb t2.glb -
python3 append_nodes.py t2.glb b7/life_butterflies.glb t3.glb meadow_butterflies_loop
python3 append_nodes.py t3.glb b7/life_birds.glb t4.glb meadow_birds_loop
python3 append_nodes.py t4.glb b7/life_flag.glb t5.glb windmill_flag_loop
python3 prune_glb.py t5.glb v7.glb; rm t?.glb; python3 fix_anim_t0.py v7.glb
