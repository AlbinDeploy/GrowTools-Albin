var items_secret_key = "PBG892FXX982ABC*"
var data_json = {}
var encoded_buffer_file = [];

const byteToHex = [];

for (let n = 0; n <= 0xff; ++n) {
    const hexOctet = n.toString(16).padStart(2, "0");
    byteToHex.push(hexOctet);
}
const a = document.createElement("a");
var saveData = (function () {
    a.style = "display: none";
    return function (data, fileName) {
        blob = new Blob([data], { type: "octet/stream" }),
            url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
    };
}());

var saveDataBuffer = (function () {
    a.style = "display: none";
    return function (data, fileName) {
        blob = new Blob([new Uint8Array(data)], { type: "octet/stream" }),
            url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
    };
}());

function hex(arrayBuffer, is_without_space) {
    const buff = new Uint8Array(arrayBuffer);
    const hexOctets = [];
    for (let i = 0; i < buff.length; ++i) hexOctets.push(byteToHex[buff[i]]);
    return hexOctets.join(is_without_space ? "" : " ");
}

function read_buffer_number(buffer, pos, len) {
    if (len <= 4) {
        let value = 0;
        for (let a = 0; a < len; a++) value += buffer[pos + a] << (a * 8);
        return value;
    } else {
        let value = 0n;
        for (let a = 0; a < len; a++) value += BigInt(buffer[pos + a]) << BigInt(a * 8);
        return Number(value);
    }
}

function write_buffer_number(pos, len, value) {
    if (len <= 4) {
        for (let a = 0; a < len; a++) {
            encoded_buffer_file[pos + a] = (value >> (a * 8)) & 255;
        }
    } else {
        let bigVal = BigInt(Math.trunc(Number(value) || 0));
        for (let a = 0; a < len; a++) {
            encoded_buffer_file[pos + a] = Number((bigVal >> BigInt(a * 8)) & 255n);
        }
    }
}

function write_buffer_string(pos, len, value, using_key, item_id) {
    for (let a = 0; a < len; a++) {
        if (using_key) encoded_buffer_file[pos + a] = value.charCodeAt(a) ^ (items_secret_key.charCodeAt((a + item_id) % items_secret_key.length))
        else encoded_buffer_file[pos + a] = value.charCodeAt(a)
    }
}

function hash_buffer(buffer, element, text) {
    var hash = 0x55555555;
    var toBuffer = new Uint8Array(buffer);
    for (let a = 0; a < toBuffer.length; a++) hash = (hash >>> 27) + (hash << 5) + toBuffer[a]
    document.getElementById(element).innerHTML = text + hash
}

// FIX #1: null/empty safety - sebelumnya crash null.map() untuk hex field kosong
function hexStringToArrayBuffer(pos, hexString) {
    if (hexString === undefined || hexString === null) return [];
    hexString = String(hexString).replace(/ /g, '');
    if (hexString.length === 0) return [];
    if (hexString.length % 2 != 0) console.log('WARNING: expecting an even number of characters in the hexString');
    var bad = hexString.match(/[G-Z\s]/i);
    if (bad) console.log('WARNING: found non-hex characters', bad);
    var matched = hexString.match(/[\dA-F]{2}/gi);
    if (!matched) return [];
    var integers = matched.map(function (s) {
        encoded_buffer_file[pos++] = parseInt(s, 16)
    });
    return integers
}

function txt_escape(v) {
    if (v === undefined || v === null) return '';
    return String(v)
        .replace(/\[/g,  '[LS]')
        .replace(/\\/g,  '[BS]')
        .replace(/\r\n/g,'[CRNL]')
        .replace(/\r/g,  '[CR]')
        .replace(/\n/g,  '[NL]');
}

function txt_unescape(v) {
    return v
        .replace(/\[CRNL\]/g, '\r\n')
        .replace(/\[NL\]/g,   '\n')
        .replace(/\[CR\]/g,   '\r')
        .replace(/\[BS\]/g,   '\\')
        .replace(/\[LS\]/g,   '[');
}

function read_buffer_string(buffer, pos, len, using_key, item_id) {
    var result = "";
    if (using_key) for (let a = 0; a < len; a++) result += String.fromCharCode(buffer[a + pos] ^ items_secret_key.charCodeAt((item_id + a) % items_secret_key.length))
    else for (let a = 0; a < len; a++) result += String.fromCharCode(buffer[a + pos])
    return result;
}

document.getElementById('decode_items_dat').addEventListener('click', function () {
    var input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    input.onchange = function (e) {
        var file = e.target.files[0];
        item_decoder(file);
    };
    document.body.appendChild(input);
    input.click();
});

document.getElementById('decode_items_dat_editor').addEventListener('click', function () {
    var input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    input.onchange = function (e) {
        var file = e.target.files[0];
        item_decoder(file, true);
    };
    document.body.appendChild(input);
    input.click();
});

document.getElementById('encode_items_dat').addEventListener('click', function () {
    var input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    input.onchange = function (e) {
        var file = e.target.files[0];
        item_encoder(file);
    };
    document.body.appendChild(input);
    input.click();
});

function check_last_char(dest, src) {
    return dest[dest.length - 1] == src
}

function process_item_encoder(result, using_txt) {
    // FIX #2: reset buffer di awal encoding - cegah leftover bytes dari encode sebelumnya yang gagal
    encoded_buffer_file = [];

    var mem_pos = 6;

    if (using_txt) {
        var version = 0;
        result = result.split("\n");

        for (let a = 0; a < result.length; a++) {
            var result1 = result[a].split("\\")
            result1 = result1.map(function(v) { return txt_unescape(v); });
            if (result1[0] == "version") {
                version = Number(result1[1])
                write_buffer_number(0, 2, Number(result1[1]))
            }
            else if (result1[0] == "itemCount") write_buffer_number(2, 4, Number(result1[1]))
            else if (result1[0] == "add_item") {
                write_buffer_number(mem_pos, 4, result1[1]);
                mem_pos += 4;

                encoded_buffer_file[mem_pos++] = Number(result1[2]);
                encoded_buffer_file[mem_pos++] = Number(result1[3]);
                encoded_buffer_file[mem_pos++] = Number(result1[4]);
                encoded_buffer_file[mem_pos++] = Number(result1[5]);

                write_buffer_number(mem_pos, 2, result1[6].length);
                mem_pos += 2;
                write_buffer_string(mem_pos, result1[6].length, result1[6], 1, Number(result1[1]))
                mem_pos += result1[6].length

                write_buffer_number(mem_pos, 2, result1[7].length);
                mem_pos += 2;
                write_buffer_string(mem_pos, result1[7].length, result1[7])
                mem_pos += result1[7].length

                write_buffer_number(mem_pos, 4, result1[8])
                mem_pos += 4;

                encoded_buffer_file[mem_pos++] = Number(result1[9])

                write_buffer_number(mem_pos, 4, result1[10])
                mem_pos += 4;

                encoded_buffer_file[mem_pos++] = Number(result1[11])
                encoded_buffer_file[mem_pos++] = Number(result1[12])
                encoded_buffer_file[mem_pos++] = Number(result1[13])
                encoded_buffer_file[mem_pos++] = Number(result1[14])
                encoded_buffer_file[mem_pos++] = Number(result1[15])

                if (result1[16].includes("r")) encoded_buffer_file[mem_pos++] = Number(result1[16].slice(0, -1))
                else encoded_buffer_file[mem_pos++] = Number(result1[16]) * 6

                write_buffer_number(mem_pos, 4, result1[17])
                mem_pos += 4;

                encoded_buffer_file[mem_pos++] = Number(result1[18])

                write_buffer_number(mem_pos, 2, result1[19])
                mem_pos += 2;

                encoded_buffer_file[mem_pos++] = Number(result1[20])

                write_buffer_number(mem_pos, 2, result1[21].length);
                mem_pos += 2;
                write_buffer_string(mem_pos, result1[21].length, result1[21])
                mem_pos += result1[21].length

                write_buffer_number(mem_pos, 4, result1[22])
                mem_pos += 4;

                write_buffer_number(mem_pos, 4, result1[23])
                mem_pos += 4;

                write_buffer_number(mem_pos, 2, result1[24].length);
                mem_pos += 2;
                write_buffer_string(mem_pos, result1[24].length, result1[24])
                mem_pos += result1[24].length

                write_buffer_number(mem_pos, 2, result1[25].length);
                mem_pos += 2;
                write_buffer_string(mem_pos, result1[25].length, result1[25])
                mem_pos += result1[25].length

                write_buffer_number(mem_pos, 2, result1[26].length);
                mem_pos += 2;
                write_buffer_string(mem_pos, result1[26].length, result1[26])
                mem_pos += result1[26].length

                write_buffer_number(mem_pos, 2, result1[27].length);
                mem_pos += 2;
                write_buffer_string(mem_pos, result1[27].length, result1[27])
                mem_pos += result1[27].length

                encoded_buffer_file[mem_pos++] = Number(result1[28])
                encoded_buffer_file[mem_pos++] = Number(result1[29])
                encoded_buffer_file[mem_pos++] = Number(result1[30])
                encoded_buffer_file[mem_pos++] = Number(result1[31])

                var to_object = result1[32].split(",")
                encoded_buffer_file[mem_pos++] = to_object[0]
                encoded_buffer_file[mem_pos++] = to_object[1]
                encoded_buffer_file[mem_pos++] = to_object[2]
                encoded_buffer_file[mem_pos++] = to_object[3]

                to_object = result1[33].split(",")
                encoded_buffer_file[mem_pos++] = to_object[0]
                encoded_buffer_file[mem_pos++] = to_object[1]
                encoded_buffer_file[mem_pos++] = to_object[2]
                encoded_buffer_file[mem_pos++] = to_object[3]

                write_buffer_number(mem_pos, 4, 0);
                mem_pos += 4;

                write_buffer_number(mem_pos, 4, result1[34]);
                mem_pos += 4;

                write_buffer_number(mem_pos, 2, result1[35]);
                mem_pos += 2;

                write_buffer_number(mem_pos, 2, result1[36]);
                mem_pos += 2;

                write_buffer_number(mem_pos, 2, result1[37].length);
                mem_pos += 2;
                write_buffer_string(mem_pos, result1[37].length, result1[37])
                mem_pos += result1[37].length

                write_buffer_number(mem_pos, 2, result1[38].length);
                mem_pos += 2;
                write_buffer_string(mem_pos, result1[38].length, result1[38])
                mem_pos += result1[38].length

                write_buffer_number(mem_pos, 2, result1[39].length);
                mem_pos += 2;
                write_buffer_string(mem_pos, result1[39].length, result1[39])
                mem_pos += result1[39].length

                hexStringToArrayBuffer(mem_pos, result1[40])
                mem_pos += 80;

                if (version >= 11) {
                    // FIX #3: safe string fallback untuk field yang missing di TXT lama
                    var f41 = result1[41] !== undefined ? result1[41] : "";
                    write_buffer_number(mem_pos, 2, f41.length);
                    mem_pos += 2;
                    write_buffer_string(mem_pos, f41.length, f41)
                    mem_pos += f41.length
                }
                if (version >= 12) {
                    hexStringToArrayBuffer(mem_pos, result1[42] || "")
                    mem_pos += 13;
                }
                if (version >= 13) {
                    write_buffer_number(mem_pos, 4, Number(result1[43]) || 0)
                    mem_pos += 4;
                }
                if (version >= 14) {
                    write_buffer_number(mem_pos, 4, Number(result1[44]) || 0)
                    mem_pos += 4;
                }
                if (version >= 15) {
                    hexStringToArrayBuffer(mem_pos, result1[45] || "")
                    mem_pos += 25;
                    var f46 = result1[46] !== undefined ? result1[46] : "";
                    write_buffer_number(mem_pos, 2, f46.length);
                    mem_pos += 2;
                    write_buffer_string(mem_pos, f46.length, f46)
                    mem_pos += f46.length
                }
                if (version >= 16) {
                    var f47 = result1[47] !== undefined ? result1[47] : "";
                    write_buffer_number(mem_pos, 2, f47.length);
                    mem_pos += 2;
                    write_buffer_string(mem_pos, f47.length, f47)
                    mem_pos += f47.length
                }
                if (version >= 17) {
                    write_buffer_number(mem_pos, 4, Number(result1[48]) || 0)
                    mem_pos += 4;
                }
                if (version >= 18) {
                    write_buffer_number(mem_pos, 4, Number(result1[49]) || 0)
                    mem_pos += 4;
                }
                if (version >= 19) {
                    write_buffer_number(mem_pos, 9, Number(result1[50]) || 0)
                    mem_pos += 9;
                }
                if (version >= 21) {
                    write_buffer_number(mem_pos, 2, Number(result1[51]) || 0)
                    mem_pos += 2;
                }
                if (version >= 22) {
                    var f52 = result1[52] !== undefined ? result1[52] : "";
                    write_buffer_number(mem_pos, 2, f52.length);
                    mem_pos += 2;
                    write_buffer_string(mem_pos, f52.length, f52)
                    mem_pos += f52.length
                }
                if (version >= 23) {
                    write_buffer_number(mem_pos, 4, Number(result1[53]) || 0)
                    mem_pos += 4;
                }
                if (version >= 24) {
                    write_buffer_number(mem_pos, 4, Number(result1[54]) || 0)
                    mem_pos += 4;
                }
                // FIX #3 (utama): safe number fallback untuk v25-27
                // Sebelumnya undefined di-pass ke write_buffer_number → silently tulis 0 yang salah
                // Sekarang eksplisit: kalau field ada pakai nilainya, kalau tidak ada pakai 0
                if (version >= 25) {
                    write_buffer_number(mem_pos, 4, Number(result1[55]) || 0)
                    mem_pos += 4;
                }
                if (version >= 26) {
                    write_buffer_number(mem_pos, 4, Number(result1[56]) || 0)
                    mem_pos += 4;
                }
                if (version >= 27) {
                    write_buffer_number(mem_pos, 4, Number(result1[57]) || 0)
                    mem_pos += 4;
                }
                // Re-emit unknown bytes untuk version > 27 (lossless round-trip)
                if (result1[58] && result1[58].length > 0) {
                    hexStringToArrayBuffer(mem_pos, result1[58]);
                    mem_pos += Math.ceil(result1[58].replace(/\s/g,'').length / 2);
                }
            }
        }
    } else {
        write_buffer_number(0, 2, result.version)
        write_buffer_number(2, 4, result.item_count)
        for (let a = 0; a < result.item_count; a++) {
            var item = result.items[a];
            write_buffer_number(mem_pos, 4, item.item_id);
            mem_pos += 4;
            encoded_buffer_file[mem_pos++] = item.editable_type
            encoded_buffer_file[mem_pos++] = item.item_category
            encoded_buffer_file[mem_pos++] = item.action_type
            encoded_buffer_file[mem_pos++] = item.hit_sound_type
            write_buffer_number(mem_pos, 2, item.name.length);
            mem_pos += 2;
            write_buffer_string(mem_pos, item.name.length, item.name, 1, item.item_id)
            mem_pos += item.name.length
            write_buffer_number(mem_pos, 2, item.texture.length);
            mem_pos += 2;
            write_buffer_string(mem_pos, item.texture.length, item.texture)
            mem_pos += item.texture.length
            write_buffer_number(mem_pos, 4, item.texture_hash)
            mem_pos += 4;
            encoded_buffer_file[mem_pos++] = item.item_kind
            write_buffer_number(mem_pos, 4, item.val1)
            mem_pos += 4;
            encoded_buffer_file[mem_pos++] = item.texture_x
            encoded_buffer_file[mem_pos++] = item.texture_y
            encoded_buffer_file[mem_pos++] = item.spread_type
            encoded_buffer_file[mem_pos++] = item.is_stripey_wallpaper
            encoded_buffer_file[mem_pos++] = item.collision_type

            if (check_last_char(item.break_hits.toString(), "r")) encoded_buffer_file[mem_pos++] = Number(item.break_hits.toString().slice(0, -1))
            else encoded_buffer_file[mem_pos++] = Number(item.break_hits) * 6

            write_buffer_number(mem_pos, 4, item.drop_chance)
            mem_pos += 4;
            encoded_buffer_file[mem_pos++] = item.clothing_type
            write_buffer_number(mem_pos, 2, item.rarity)
            mem_pos += 2;
            encoded_buffer_file[mem_pos++] = item.max_amount
            write_buffer_number(mem_pos, 2, item.extra_file.length);
            mem_pos += 2;
            write_buffer_string(mem_pos, item.extra_file.length, item.extra_file)
            mem_pos += item.extra_file.length
            write_buffer_number(mem_pos, 4, item.extra_file_hash)
            mem_pos += 4;
            write_buffer_number(mem_pos, 4, item.audio_volume)
            mem_pos += 4;
            write_buffer_number(mem_pos, 2, item.pet_name.length);
            mem_pos += 2;
            write_buffer_string(mem_pos, item.pet_name.length, item.pet_name)
            mem_pos += item.pet_name.length
            write_buffer_number(mem_pos, 2, item.pet_prefix.length);
            mem_pos += 2;
            write_buffer_string(mem_pos, item.pet_prefix.length, item.pet_prefix)
            mem_pos += item.pet_prefix.length
            write_buffer_number(mem_pos, 2, item.pet_suffix.length);
            mem_pos += 2;
            write_buffer_string(mem_pos, item.pet_suffix.length, item.pet_suffix)
            mem_pos += item.pet_suffix.length
            write_buffer_number(mem_pos, 2, item.pet_ability.length);
            mem_pos += 2;
            write_buffer_string(mem_pos, item.pet_ability.length, item.pet_ability)
            mem_pos += item.pet_ability.length
            encoded_buffer_file[mem_pos++] = item.seed_base
            encoded_buffer_file[mem_pos++] = item.seed_overlay
            encoded_buffer_file[mem_pos++] = item.tree_base
            encoded_buffer_file[mem_pos++] = item.tree_leaves
            encoded_buffer_file[mem_pos++] = item.seed_color.a
            encoded_buffer_file[mem_pos++] = item.seed_color.r
            encoded_buffer_file[mem_pos++] = item.seed_color.g
            encoded_buffer_file[mem_pos++] = item.seed_color.b
            encoded_buffer_file[mem_pos++] = item.seed_overlay_color.a
            encoded_buffer_file[mem_pos++] = item.seed_overlay_color.r
            encoded_buffer_file[mem_pos++] = item.seed_overlay_color.g
            encoded_buffer_file[mem_pos++] = item.seed_overlay_color.b
            write_buffer_number(mem_pos, 4, 0);
            mem_pos += 4;
            write_buffer_number(mem_pos, 4, item.grow_time);
            mem_pos += 4;
            write_buffer_number(mem_pos, 2, item.val2);
            mem_pos += 2;
            write_buffer_number(mem_pos, 2, item.is_rayman);
            mem_pos += 2;
            write_buffer_number(mem_pos, 2, item.extra_options.length);
            mem_pos += 2;
            write_buffer_string(mem_pos, item.extra_options.length, item.extra_options)
            mem_pos += item.extra_options.length
            write_buffer_number(mem_pos, 2, item.texture2.length);
            mem_pos += 2;
            write_buffer_string(mem_pos, item.texture2.length, item.texture2)
            mem_pos += item.texture2.length
            write_buffer_number(mem_pos, 2, item.extra_options2.length);
            mem_pos += 2;
            write_buffer_string(mem_pos, item.extra_options2.length, item.extra_options2)
            mem_pos += item.extra_options2.length
            hexStringToArrayBuffer(mem_pos, item.data_position_80)
            mem_pos += 80;
            if (result.version >= 11) {
                var po = item.punch_options || "";
                write_buffer_number(mem_pos, 2, po.length);
                mem_pos += 2;
                write_buffer_string(mem_pos, po.length, po)
                mem_pos += po.length
            }
            if (result.version >= 12) {
                hexStringToArrayBuffer(mem_pos, item.data_version_12 || "")
                mem_pos += 13;
            }
            if (result.version >= 13) {
                write_buffer_number(mem_pos, 4, item.int_version_13 || 0)
                mem_pos += 4;
            }
            if (result.version >= 14) {
                write_buffer_number(mem_pos, 4, item.int_version_14 || 0)
                mem_pos += 4;
            }
            if (result.version >= 15) {
                hexStringToArrayBuffer(mem_pos, item.data_version_15 || "")
                mem_pos += 25;
                var sv15 = item.str_version_15 || "";
                write_buffer_number(mem_pos, 2, sv15.length);
                mem_pos += 2;
                write_buffer_string(mem_pos, sv15.length, sv15)
                mem_pos += sv15.length
            }
            if (result.version >= 16) {
                var sv16 = item.str_version_16 || "";
                write_buffer_number(mem_pos, 2, sv16.length);
                mem_pos += 2;
                write_buffer_string(mem_pos, sv16.length, sv16)
                mem_pos += sv16.length
            }
            if (result.version >= 17) {
                write_buffer_number(mem_pos, 4, item.int_version_17 || 0)
                mem_pos += 4;
            }
            if (result.version >= 18) {
                write_buffer_number(mem_pos, 4, item.int_version_18 || 0)
                mem_pos += 4;
            }
            if (result.version >= 19) {
                write_buffer_number(mem_pos, 9, item.int_version_19 || 0)
                mem_pos += 9;
            }
            if (result.version >= 21) {
                write_buffer_number(mem_pos, 2, item.int_version_21 || 0)
                mem_pos += 2;
            }
            if (result.version >= 22) {
                var sv22 = item.str_version_22 || "";
                write_buffer_number(mem_pos, 2, sv22.length);
                mem_pos += 2;
                write_buffer_string(mem_pos, sv22.length, sv22)
                mem_pos += sv22.length
            }
            if (result.version >= 23) {
                write_buffer_number(mem_pos, 4, item.int_version_23 || 0)
                mem_pos += 4;
            }
            if (result.version >= 24) {
                write_buffer_number(mem_pos, 4, item.int_version_24 || 0)
                mem_pos += 4;
            }
            // FIX #3 JSON path: || 0 untuk cegah undefined masuk write_buffer_number
            if (result.version >= 25) {
                write_buffer_number(mem_pos, 4, item.int_version_25 || 0)
                mem_pos += 4;
            }
            if (result.version >= 26) {
                write_buffer_number(mem_pos, 4, item.int_version_26 || 0)
                mem_pos += 4;
            }
            if (result.version >= 27) {
                write_buffer_number(mem_pos, 4, item.int_version_27 || 0)
                mem_pos += 4;
            }
            // Re-emit unknown bytes untuk version > 27 (lossless round-trip)
            if (item.extra_unknown && item.extra_unknown.length > 0) {
                hexStringToArrayBuffer(mem_pos, item.extra_unknown);
                mem_pos += Math.ceil(item.extra_unknown.replace(/\s/g,'').length / 2);
            }
        }
    }
}

function item_encoder(file, using_editor) {
    if (using_editor) {
        process_item_encoder(data_json, 0);
        saveDataBuffer(encoded_buffer_file, "items.dat")
        hash_buffer(encoded_buffer_file, "items_dat_hash_2", "Encoded Items dat Hash: ")
        return encoded_buffer_file = []
    } else {
        var reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function (e) {
            try {
                if (document.getElementById("using_txt_mode").checked) process_item_encoder(e.target.result, 1)
                else process_item_encoder(JSON.parse(e.target.result), 0)
                saveDataBuffer(encoded_buffer_file, "items.dat")
                hash_buffer(encoded_buffer_file, "items_dat_hash_1", "Encoded Items dat Hash: ")
                return encoded_buffer_file = []
            } catch (error) {
                encoded_buffer_file = []; // FIX #2: reset juga di catch
                console.error('Error encoding items.dat:', error);
            }
        }
    }
}

function item_decoder(file, using_editor) {
    data_json = {}
    let mem_pos = 6;
    var reader = new FileReader()
    reader.readAsArrayBuffer(file);

    reader.onload = function (e) {
        var arrayBuffer = new Uint8Array(e.target.result);
        var version = read_buffer_number(arrayBuffer, 0, 2);
        var item_count = read_buffer_number(arrayBuffer, 2, 4);
        var txt_mode = document.getElementById("using_txt_mode") ? document.getElementById("using_txt_mode").checked : false;

        if (version > 27) {
            Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 5000
            }).fire({
                icon: 'warning',
                title: "items.dat v" + version + " detected. Fields beyond v27 will be stored as raw hex (extra_unknown). Decode may be partial."
            })
        }
        data_json.version = version
        data_json.item_count = item_count
        data_json.items = []

        for (let a = 0; a < item_count; a++) {
          try {
            var item_start_pos = mem_pos;
            var item_id = read_buffer_number(arrayBuffer, mem_pos, 4);
            mem_pos += 4;

            var editable_type = arrayBuffer[mem_pos++];
            var item_category = arrayBuffer[mem_pos++];
            var action_type = arrayBuffer[mem_pos++];
            var hit_sound_type = arrayBuffer[mem_pos++];

            var len = read_buffer_number(arrayBuffer, mem_pos, 2)
            mem_pos += 2;
            var name = read_buffer_string(arrayBuffer, mem_pos, len, true, Number(item_id));
            mem_pos += len;

            len = read_buffer_number(arrayBuffer, mem_pos, 2)
            mem_pos += 2;
            var texture = read_buffer_string(arrayBuffer, mem_pos, len);
            mem_pos += len;

            var texture_hash = read_buffer_number(arrayBuffer, mem_pos, 4);
            mem_pos += 4;

            var item_kind = arrayBuffer[mem_pos++];

            var val1 = read_buffer_number(arrayBuffer, mem_pos, 4);
            mem_pos += 4;

            var texture_x = arrayBuffer[mem_pos++];
            var texture_y = arrayBuffer[mem_pos++];
            var spread_type = arrayBuffer[mem_pos++];
            var is_stripey_wallpaper = arrayBuffer[mem_pos++];
            var collision_type = arrayBuffer[mem_pos++];
            var break_hits = arrayBuffer[mem_pos++];

            if ((break_hits % 6) !== 0) break_hits = break_hits + "r"
            else break_hits = break_hits / 6

            var drop_chance = read_buffer_number(arrayBuffer, mem_pos, 4);
            mem_pos += 4;

            var clothing_type = arrayBuffer[mem_pos++];

            var rarity = read_buffer_number(arrayBuffer, mem_pos, 2);
            mem_pos += 2;

            var max_amount = arrayBuffer[mem_pos++];

            len = read_buffer_number(arrayBuffer, mem_pos, 2)
            mem_pos += 2;
            var extra_file = read_buffer_string(arrayBuffer, mem_pos, len);
            mem_pos += len;

            var extra_file_hash = read_buffer_number(arrayBuffer, mem_pos, 4);
            mem_pos += 4;

            var audio_volume = read_buffer_number(arrayBuffer, mem_pos, 4);
            mem_pos += 4;

            len = read_buffer_number(arrayBuffer, mem_pos, 2)
            mem_pos += 2;
            var pet_name = read_buffer_string(arrayBuffer, mem_pos, len);
            mem_pos += len;

            len = read_buffer_number(arrayBuffer, mem_pos, 2)
            mem_pos += 2;
            var pet_prefix = read_buffer_string(arrayBuffer, mem_pos, len);
            mem_pos += len;

            len = read_buffer_number(arrayBuffer, mem_pos, 2)
            mem_pos += 2;
            var pet_suffix = read_buffer_string(arrayBuffer, mem_pos, len);
            mem_pos += len;

            len = read_buffer_number(arrayBuffer, mem_pos, 2);
            mem_pos += 2;
            var pet_ability = read_buffer_string(arrayBuffer, mem_pos, len);
            mem_pos += len;

            var seed_base = arrayBuffer[mem_pos++];
            var seed_overlay = arrayBuffer[mem_pos++];
            var tree_base = arrayBuffer[mem_pos++];
            var tree_leaves = arrayBuffer[mem_pos++];

            var seed_color_a = arrayBuffer[mem_pos++];
            var seed_color_r = arrayBuffer[mem_pos++];
            var seed_color_g = arrayBuffer[mem_pos++];
            var seed_color_b = arrayBuffer[mem_pos++];
            var seed_overlay_color_a = arrayBuffer[mem_pos++];
            var seed_overlay_color_r = arrayBuffer[mem_pos++];
            var seed_overlay_color_g = arrayBuffer[mem_pos++];
            var seed_overlay_color_b = arrayBuffer[mem_pos++];

            mem_pos += 4; // skipping ingredients

            var grow_time = read_buffer_number(arrayBuffer, mem_pos, 4);
            mem_pos += 4;

            var val2 = read_buffer_number(arrayBuffer, mem_pos, 2);
            mem_pos += 2;
            var is_rayman = read_buffer_number(arrayBuffer, mem_pos, 2);
            mem_pos += 2;

            len = read_buffer_number(arrayBuffer, mem_pos, 2)
            mem_pos += 2;
            var extra_options = read_buffer_string(arrayBuffer, mem_pos, len);
            mem_pos += len;

            len = read_buffer_number(arrayBuffer, mem_pos, 2)
            mem_pos += 2;
            var texture2 = read_buffer_string(arrayBuffer, mem_pos, len);
            mem_pos += len;

            len = read_buffer_number(arrayBuffer, mem_pos, 2)
            mem_pos += 2;
            var extra_options2 = read_buffer_string(arrayBuffer, mem_pos, len);
            mem_pos += len;

            var data_position_80 = hex(arrayBuffer.slice(mem_pos, mem_pos + 80), txt_mode).toUpperCase()
            mem_pos += 80;

            var punch_options = "", data_version_12 = "", int_version_13 = 0, int_version_14 = 0;
            var data_version_15 = "", str_version_15 = "", str_version_16 = "";
            var int_version_17 = 0, int_version_18 = 0, int_version_19 = 0;
            var int_version_21 = 0, str_version_22 = "";
            var int_version_23 = 0, int_version_24 = 0;
            var int_version_25 = 0, int_version_26 = 0, int_version_27 = 0;

            if (version >= 11) {
                len = read_buffer_number(arrayBuffer, mem_pos, 2)
                mem_pos += 2;
                punch_options = read_buffer_string(arrayBuffer, mem_pos, len);
                mem_pos += len;
            }
            if (version >= 12) {
                data_version_12 = hex(arrayBuffer.slice(mem_pos, mem_pos + 13), txt_mode).toUpperCase()
                mem_pos += 13;
            }
            if (version >= 13) {
                int_version_13 = read_buffer_number(arrayBuffer, mem_pos, 4)
                mem_pos += 4;
            }
            if (version >= 14) {
                int_version_14 = read_buffer_number(arrayBuffer, mem_pos, 4)
                mem_pos += 4;
            }
            if (version >= 15) {
                data_version_15 = hex(arrayBuffer.slice(mem_pos, mem_pos + 25), txt_mode).toUpperCase()
                mem_pos += 25;
                len = read_buffer_number(arrayBuffer, mem_pos, 2);
                mem_pos += 2;
                str_version_15 = read_buffer_string(arrayBuffer, mem_pos, len);
                mem_pos += len
            }
            if (version >= 16) {
                len = read_buffer_number(arrayBuffer, mem_pos, 2)
                mem_pos += 2;
                str_version_16 = read_buffer_string(arrayBuffer, mem_pos, len);
                mem_pos += len
            }
            if (version >= 17) {
                int_version_17 = read_buffer_number(arrayBuffer, mem_pos, 4)
                mem_pos += 4;
            }
            if (version >= 18) {
                int_version_18 = read_buffer_number(arrayBuffer, mem_pos, 4)
                mem_pos += 4;
            }
            if (version >= 19) {
                int_version_19 = read_buffer_number(arrayBuffer, mem_pos, 9)
                mem_pos += 9;
            }
            if (version >= 21) {
                int_version_21 = read_buffer_number(arrayBuffer, mem_pos, 2)
                mem_pos += 2;
            }
            if (version >= 22) {
                len = read_buffer_number(arrayBuffer, mem_pos, 2)
                mem_pos += 2;
                str_version_22 = read_buffer_string(arrayBuffer, mem_pos, len);
                mem_pos += len
            }
            if (version >= 23) {
                int_version_23 = read_buffer_number(arrayBuffer, mem_pos, 4)
                mem_pos += 4;
            }
            if (version >= 24) {
                int_version_24 = read_buffer_number(arrayBuffer, mem_pos, 4)
                mem_pos += 4;
            }
            if (version >= 25) {
                int_version_25 = read_buffer_number(arrayBuffer, mem_pos, 4)
                mem_pos += 4;
            }
            if (version >= 26) {
                int_version_26 = read_buffer_number(arrayBuffer, mem_pos, 4)
                mem_pos += 4;
            }
            if (version >= 27) {
                int_version_27 = read_buffer_number(arrayBuffer, mem_pos, 4)
                mem_pos += 4;
            }

            if (item_id != a) console.log(`Unordered Items at ${a}`)

            data_json.items[a] = {}
            data_json.items[a].item_id = item_id
            data_json.items[a].editable_type = editable_type
            data_json.items[a].item_category = item_category
            data_json.items[a].action_type = action_type
            data_json.items[a].hit_sound_type = hit_sound_type
            data_json.items[a].name = name
            data_json.items[a].texture = texture
            data_json.items[a].texture_hash = texture_hash
            data_json.items[a].item_kind = item_kind
            data_json.items[a].val1 = val1
            data_json.items[a].texture_x = texture_x
            data_json.items[a].texture_y = texture_y
            data_json.items[a].spread_type = spread_type
            data_json.items[a].is_stripey_wallpaper = is_stripey_wallpaper
            data_json.items[a].collision_type = collision_type
            data_json.items[a].break_hits = break_hits
            data_json.items[a].drop_chance = drop_chance
            data_json.items[a].clothing_type = clothing_type
            data_json.items[a].rarity = rarity
            data_json.items[a].max_amount = max_amount
            data_json.items[a].extra_file = extra_file
            data_json.items[a].extra_file_hash = extra_file_hash
            data_json.items[a].audio_volume = audio_volume
            data_json.items[a].pet_name = pet_name
            data_json.items[a].pet_prefix = pet_prefix
            data_json.items[a].pet_suffix = pet_suffix
            data_json.items[a].pet_ability = pet_ability
            data_json.items[a].seed_base = seed_base
            data_json.items[a].seed_overlay = seed_overlay
            data_json.items[a].tree_base = tree_base
            data_json.items[a].tree_leaves = tree_leaves

            if (txt_mode) {
                data_json.items[a].seed_color = `${seed_color_a},${seed_color_r},${seed_color_g},${seed_color_b}`
                data_json.items[a].seed_overlay_color = `${seed_overlay_color_a},${seed_overlay_color_r},${seed_overlay_color_g},${seed_overlay_color_b}`
            } else {
                data_json.items[a].seed_color = {}
                data_json.items[a].seed_color.a = seed_color_a
                data_json.items[a].seed_color.r = seed_color_r
                data_json.items[a].seed_color.g = seed_color_g
                data_json.items[a].seed_color.b = seed_color_b

                data_json.items[a].seed_overlay_color = {}
                data_json.items[a].seed_overlay_color.a = seed_overlay_color_a
                data_json.items[a].seed_overlay_color.r = seed_overlay_color_r
                data_json.items[a].seed_overlay_color.g = seed_overlay_color_g
                data_json.items[a].seed_overlay_color.b = seed_overlay_color_b
            }

            data_json.items[a].grow_time = grow_time
            data_json.items[a].val2 = val2
            data_json.items[a].is_rayman = is_rayman
            data_json.items[a].extra_options = extra_options
            data_json.items[a].texture2 = texture2
            data_json.items[a].extra_options2 = extra_options2
            data_json.items[a].data_position_80 = data_position_80
            data_json.items[a].punch_options = punch_options
            data_json.items[a].data_version_12 = data_version_12
            data_json.items[a].int_version_13 = int_version_13
            data_json.items[a].int_version_14 = int_version_14
            data_json.items[a].data_version_15 = data_version_15
            data_json.items[a].str_version_15 = str_version_15
            data_json.items[a].str_version_16 = str_version_16
            data_json.items[a].int_version_17 = int_version_17
            data_json.items[a].int_version_18 = int_version_18
            data_json.items[a].int_version_19 = int_version_19
            data_json.items[a].int_version_21 = int_version_21
            data_json.items[a].str_version_22 = str_version_22
            data_json.items[a].int_version_23 = int_version_23
            data_json.items[a].int_version_24 = int_version_24
            data_json.items[a].int_version_25 = int_version_25
            data_json.items[a].int_version_26 = int_version_26
            data_json.items[a].int_version_27 = int_version_27

            // Untuk version > 27: tangkap sisa bytes per item sebagai raw hex
            if (version > 27 && mem_pos < arrayBuffer.length) {
                var next_expected_id = a + 1;
                var scan_limit = Math.min(mem_pos + 1024, arrayBuffer.length - 4);
                var found_next = false;
                for (var sp = mem_pos; sp < scan_limit; sp++) {
                    var peek_id = (arrayBuffer[sp]) |
                                  (arrayBuffer[sp+1] << 8) |
                                  (arrayBuffer[sp+2] << 16) |
                                  (arrayBuffer[sp+3] << 24);
                    peek_id = peek_id >>> 0;
                    if (peek_id === next_expected_id && a < item_count - 1) {
                        data_json.items[a].extra_unknown = sp > mem_pos
                            ? hex(arrayBuffer.slice(mem_pos, sp), true).toUpperCase()
                            : "";
                        mem_pos = sp;
                        found_next = true;
                        break;
                    }
                }
                if (!found_next) {
                    data_json.items[a].extra_unknown = "";
                }
            } else {
                data_json.items[a].extra_unknown = "";
            }
          } catch (item_err) {
            console.error("Error decoding item " + a + " at pos " + mem_pos + ":", item_err);
            var recovered = false;
            var next_id = a + 1;
            var scan_start = item_start_pos + 4;
            var scan_end = Math.min(arrayBuffer.length - 4, scan_start + 65536);
            for (var rp = scan_start; rp < scan_end; rp++) {
                var peek = (arrayBuffer[rp]) |
                           (arrayBuffer[rp+1] << 8) |
                           (arrayBuffer[rp+2] << 16) |
                           (arrayBuffer[rp+3] << 24);
                peek = peek >>> 0;
                if (peek === next_id) {
                    mem_pos = rp;
                    recovered = true;
                    break;
                }
            }
            if (recovered) {
                console.warn("Recovered at item " + a + " — skipped to item_id " + next_id + " at pos " + mem_pos);
                continue;
            } else {
                data_json.item_count = a;
                Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 8000 })
                    .fire({ icon: 'warning', title: "Stopped at item " + a + "/" + item_count + ". Could not recover offset." });
                break;
            }
          }
        }

        if (using_editor) {
            if (!$.fn.dataTable.isDataTable("#itemsList")) {
                document.getElementById("itemsList").classList.remove("d-none")
                document.getElementById("save_items_dat_div").classList.remove("d-none")
                $("#itemsList").DataTable({
                    scrollY: "500px",
                    scrollX: true,
                    scrollCollapse: true,
                    paging: true,
                    fixedColumns: { left: 1, right: 1 },
                    "lengthChange": false,
                    "autoWidth": false,
                    "columnDefs": [{
                        "targets": [0],
                        "render": function (data, type, full, meta) {
                            return type === 'display' && typeof data === 'string' ?
                                data.replace(/</g, '&lt;').replace(/>/g, '&gt;') : data;
                        }
                    }]
                }).buttons().container().appendTo('#itemsList_wrapper .col-md-6:eq(0)');
                $('#itemsList').DataTable().columns.adjust()
                $(window).resize(function () { $('#itemsList').DataTable().columns.adjust() });
            }
            var result = []
            for (let a = 0; a < item_count; a++) {
                result[a] = []
                result[a][0] = data_json.items[a].item_id
                result[a][1] = data_json.items[a].name
                result[a][2] = `<center><button class="btn btn-primary" onclick="editItems(${a})">Edit/Info</button></center>`
            }
            $("#itemsList").DataTable().rows.add(result).draw()
            result = []
        } else {
            if (txt_mode) {
                var to_txt_result = `//Credit: IProgramInCPP & GrowtopiaNoobs\n//Format: add_item\\${Object.keys(data_json.items[0]).join("\\")}\n//NOTE: There are several items, for the breakhits part, add 'r'.\n//Example: 184r\n//What does it mean? So, adding 'r' to breakhits makes it raw breakhits, meaning, if you add 'r' to breakhits, when encoding items.dat, the encoder won't multiply it by 6.\n\nversion\\${data_json.version}\nitemCount\\${data_json.item_count}\n\n`;
                for (let a = 0; a < item_count; a++) {
                    var escaped_vals = Object.values(data_json.items[a]).map(function(v) { return txt_escape(v); });
                    to_txt_result += "add_item\\" + escaped_vals.join("\\") + "\n";
                }
                saveData(to_txt_result, "items.txt")
            } else saveData(JSON.stringify(data_json, null, 4), "items.json");
            data_json = {}
        }
    };
};

function editItems(posArray) {
    $("#modal-editItems").modal("show")
    document.getElementById("item_id").value = data_json.items[posArray].item_id
    document.getElementById("editable_type").value = data_json.items[posArray].editable_type
    document.getElementById("item_category").value = data_json.items[posArray].item_category
    document.getElementById("action_type").value = data_json.items[posArray].action_type
    document.getElementById("hit_sound_type").value = data_json.items[posArray].hit_sound_type
    document.getElementById("name").value = data_json.items[posArray].name
    document.getElementById("texture").value = data_json.items[posArray].texture
    document.getElementById("texture_hash").value = data_json.items[posArray].texture_hash
    document.getElementById("item_kind").value = data_json.items[posArray].item_kind
    document.getElementById("val1").value = data_json.items[posArray].val1
    document.getElementById("texture_x").value = data_json.items[posArray].texture_x
    document.getElementById("texture_y").value = data_json.items[posArray].texture_y
    document.getElementById("spread_type").value = data_json.items[posArray].spread_type
    document.getElementById("is_stripey_wallpaper").value = data_json.items[posArray].is_stripey_wallpaper
    document.getElementById("collision_type").value = data_json.items[posArray].collision_type
    document.getElementById("break_hits").value = data_json.items[posArray].break_hits
    document.getElementById("drop_chance").value = data_json.items[posArray].drop_chance
    document.getElementById("clothing_type").value = data_json.items[posArray].clothing_type
    document.getElementById("rarity").value = data_json.items[posArray].rarity
    document.getElementById("max_amount").value = data_json.items[posArray].max_amount
    document.getElementById("extra_file").value = data_json.items[posArray].extra_file
    document.getElementById("extra_file_hash").value = data_json.items[posArray].extra_file_hash
    document.getElementById("audio_volume").value = data_json.items[posArray].audio_volume
    document.getElementById("pet_name").value = data_json.items[posArray].pet_name
    document.getElementById("pet_prefix").value = data_json.items[posArray].pet_prefix
    document.getElementById("pet_suffix").value = data_json.items[posArray].pet_suffix
    document.getElementById("pet_ability").value = data_json.items[posArray].pet_ability
    document.getElementById("seed_base").value = data_json.items[posArray].seed_base
    document.getElementById("seed_overlay").value = data_json.items[posArray].seed_overlay
    document.getElementById("tree_base").value = data_json.items[posArray].tree_base
    document.getElementById("tree_leaves").value = data_json.items[posArray].tree_leaves
    document.getElementById("seed_color").value = Object.values(data_json.items[posArray].seed_color).toString()
    document.getElementById("seed_overlay_color").value = Object.values(data_json.items[posArray].seed_overlay_color).toString()
    document.getElementById("grow_time").value = data_json.items[posArray].grow_time
    document.getElementById("val2").value = data_json.items[posArray].val2
    document.getElementById("is_rayman").value = data_json.items[posArray].is_rayman
    document.getElementById("extra_options").value = data_json.items[posArray].extra_options
    document.getElementById("texture2").value = data_json.items[posArray].texture2
    document.getElementById("extra_options2").value = data_json.items[posArray].extra_options2
    document.getElementById("pos_80_data").value = data_json.items[posArray].data_position_80
    document.getElementById("punch_options").value = data_json.items[posArray].punch_options
    document.getElementById("data_version_12").value = data_json.items[posArray].data_version_12
    document.getElementById("int_version_13").value = data_json.items[posArray].int_version_13
    document.getElementById("int_version_14").value = data_json.items[posArray].int_version_14
    document.getElementById("data_version_15").value = data_json.items[posArray].data_version_15
    document.getElementById("str_version_15").value = data_json.items[posArray].str_version_15
    document.getElementById("str_version_16").value = data_json.items[posArray].str_version_16
    document.getElementById("int_version_17").value = data_json.items[posArray].int_version_17
    document.getElementById("int_version_18").value = data_json.items[posArray].int_version_18
    document.getElementById("int_version_19").value = data_json.items[posArray].int_version_19
    document.getElementById("int_version_21").value = data_json.items[posArray].int_version_21
    document.getElementById("str_version_22").value = data_json.items[posArray].str_version_22
    document.getElementById("int_version_23").value = data_json.items[posArray].int_version_23
    document.getElementById("int_version_24").value = data_json.items[posArray].int_version_24
    document.getElementById("int_version_25").value = data_json.items[posArray].int_version_25
    document.getElementById("int_version_26").value = data_json.items[posArray].int_version_26
    document.getElementById("int_version_27").value = data_json.items[posArray].int_version_27
    document.getElementById("editItemsButton").setAttribute("onclick", `processEditItems(${posArray})`)
}

function processEditItems(posArray) {
    data_json.items[posArray].item_id = document.getElementById("item_id").value
    data_json.items[posArray].editable_type = document.getElementById("editable_type").value
    data_json.items[posArray].item_category = document.getElementById("item_category").value
    data_json.items[posArray].action_type = document.getElementById("action_type").value
    data_json.items[posArray].hit_sound_type = document.getElementById("hit_sound_type").value
    data_json.items[posArray].name = document.getElementById("name").value
    data_json.items[posArray].texture = document.getElementById("texture").value
    data_json.items[posArray].texture_hash = document.getElementById("texture_hash").value
    data_json.items[posArray].item_kind = document.getElementById("item_kind").value
    data_json.items[posArray].val1 = document.getElementById("val1").value
    data_json.items[posArray].texture_x = document.getElementById("texture_x").value
    data_json.items[posArray].texture_y = document.getElementById("texture_y").value
    data_json.items[posArray].spread_type = document.getElementById("spread_type").value
    data_json.items[posArray].is_stripey_wallpaper = document.getElementById("is_stripey_wallpaper").value
    data_json.items[posArray].collision_type = document.getElementById("collision_type").value
    data_json.items[posArray].break_hits = document.getElementById("break_hits").value
    data_json.items[posArray].drop_chance = document.getElementById("drop_chance").value
    data_json.items[posArray].clothing_type = document.getElementById("clothing_type").value
    data_json.items[posArray].rarity = document.getElementById("rarity").value
    data_json.items[posArray].max_amount = document.getElementById("max_amount").value
    data_json.items[posArray].extra_file = document.getElementById("extra_file").value
    data_json.items[posArray].extra_file_hash = document.getElementById("extra_file_hash").value
    data_json.items[posArray].audio_volume = document.getElementById("audio_volume").value
    data_json.items[posArray].pet_name = document.getElementById("pet_name").value
    data_json.items[posArray].pet_prefix = document.getElementById("pet_prefix").value
    data_json.items[posArray].pet_suffix = document.getElementById("pet_suffix").value
    data_json.items[posArray].pet_ability = document.getElementById("pet_ability").value
    data_json.items[posArray].seed_base = document.getElementById("seed_base").value
    data_json.items[posArray].seed_overlay = document.getElementById("seed_overlay").value
    data_json.items[posArray].tree_base = document.getElementById("tree_base").value
    data_json.items[posArray].tree_leaves = document.getElementById("tree_leaves").value

    var to_arr = document.getElementById("seed_color").value.split(",")
    data_json.items[posArray].seed_color.a = to_arr[0]
    data_json.items[posArray].seed_color.r = to_arr[1]
    data_json.items[posArray].seed_color.g = to_arr[2]
    data_json.items[posArray].seed_color.b = to_arr[3]

    to_arr = document.getElementById("seed_overlay_color").value.split(",")
    data_json.items[posArray].seed_overlay_color.a = to_arr[0]
    data_json.items[posArray].seed_overlay_color.r = to_arr[1]
    data_json.items[posArray].seed_overlay_color.g = to_arr[2]
    data_json.items[posArray].seed_overlay_color.b = to_arr[3]

    data_json.items[posArray].grow_time = document.getElementById("grow_time").value
    data_json.items[posArray].val2 = document.getElementById("val2").value
    data_json.items[posArray].is_rayman = document.getElementById("is_rayman").value
    data_json.items[posArray].extra_options = document.getElementById("extra_options").value
    data_json.items[posArray].texture2 = document.getElementById("texture2").value
    data_json.items[posArray].extra_options2 = document.getElementById("extra_options2").value
    data_json.items[posArray].data_position_80 = document.getElementById("pos_80_data").value
    data_json.items[posArray].punch_options = document.getElementById("punch_options").value
    data_json.items[posArray].data_version_12 = document.getElementById("data_version_12").value
    data_json.items[posArray].int_version_13 = document.getElementById("int_version_13").value
    data_json.items[posArray].int_version_14 = document.getElementById("int_version_14").value
    data_json.items[posArray].data_version_15 = document.getElementById("data_version_15").value
    data_json.items[posArray].str_version_15 = document.getElementById("str_version_15").value
    data_json.items[posArray].str_version_16 = document.getElementById("str_version_16").value
    data_json.items[posArray].int_version_17 = document.getElementById("int_version_17").value
    data_json.items[posArray].int_version_18 = document.getElementById("int_version_18").value
    data_json.items[posArray].int_version_19 = document.getElementById("int_version_19").value
    data_json.items[posArray].int_version_21 = document.getElementById("int_version_21").value
    data_json.items[posArray].str_version_22 = document.getElementById("str_version_22").value
    data_json.items[posArray].int_version_23 = document.getElementById("int_version_23").value
    data_json.items[posArray].int_version_24 = document.getElementById("int_version_24").value
    data_json.items[posArray].int_version_25 = document.getElementById("int_version_25").value
    data_json.items[posArray].int_version_26 = document.getElementById("int_version_26").value
    data_json.items[posArray].int_version_27 = document.getElementById("int_version_27").value
    $("#modal-editItems").modal("hide")
}
