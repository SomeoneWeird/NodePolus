import Connection from "./Connection.js";
import Game from "./Game.js";
import Publicity from "../data/enums/publicity.js";
import { RoomSettings } from "../packets/PacketElements/RoomSettings.js";
import { EventEmitter } from "events";
import Player from "./Player.js";
import { Packet as Subpacket } from "../packets/UnreliablePacket.js";
import Server from "../Server.js";
import { IGameObject } from "./GameObject.js";
import { GameDataPacket, GameDataPacketType } from "../packets/Subpackets/GameData.js";
// @ts-ignore
import randomstring from "randomstring";
import { addr2str } from "./misc.js";
import {inspect} from 'util';
import { RPCPacket } from "../packets/Subpackets/GameDataPackets/RPC.js";
import DisconnectReason from "../packets/PacketElements/DisconnectReason.js";
import PolusBuffer from "./PolusBuffer.js";

class Room extends EventEmitter {
    constructor(public server: Server) {
        super();
        this.internalCode = "KEKPOG"/*randomstring.generate({
            length: 6,
            charset: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        })*/
    }
    public connections: Connection[] = [];
    private internalCode: string;
    public get code():string {
        return this.internalCode
    }
    public set code(input: string) {
        throw new Error("Use <Room>#setCode(<string>) to set the room code")
    }
    private internalSettings:RoomSettings = new RoomSettings();
    public get settings(): RoomSettings {
        return this.internalSettings
    };
    public set settings(input: RoomSettings) {
        this.internalSettings = <RoomSettings>input;
        this.syncSettings();
    };
    public GameObjects:IGameObject[] = [];
    game: Game;
    publicity: Publicity;
    server: Server;
    setCode(code:string) {
        this.code = code;
        //TODO: send update game code packet to clients
    }
    setPublicity(publicity:Publicity) {
        this.publicity = publicity;
        //TODO: send AlterGame packet to clients
    }
    syncSettings() {
        //TODO: send SyncSettings packet to clients
    }
    get host():Connection {
        return this.connections.find(con => con.player.isHost);
    }
    handlePacket(packet: Subpacket, connection: Connection) {
        // @ts-ignore
        switch(packet.type) {
            case "EndGame":
            case "StartGame":
                this.connections.forEach(otherClient => {
                    // @ts-ignore
                    otherClient.send(packet.type, packet)
                })
                break;
            case "KickPlayer":
            case "RemovePlayer":
                this.connections.forEach(otherClient => {
                    // @ts-ignore
                    otherClient.send(packet.type, packet)
                })
                //TODO: NOT SENT TO PLAYER BEING REMOVED / KICK
                //TODOPRIORITY: CRITICAL
                break;
            case "GameData":
                if ((<GameDataPacket>packet).RecipientClientID && (<GameDataPacket>packet).RecipientClientID === 2147483646n) {
                    connection.send("RemovePlayer", {
                        RoomCode: this.code,
                        PlayerClientID: 2147483646,
                        HostClientID: this.host.ID,
                        DisconnectReason: new DisconnectReason(new PolusBuffer(Buffer.from("00", 'hex')))
                    })
                    break;
                }
                if ((<GameDataPacket>packet).RecipientClientID) {
                    this.connections.filter(conn => BigInt(conn.ID) == (<GameDataPacket>packet).RecipientClientID).forEach(recipient => {
                        // @ts-ignore
                        recipient.send(packet.type, packet)
                    })
                }
                (<GameDataPacket>packet).Packets.forEach(GDPacket => {
                    //console.log(GDPacket)
					// @ts-ignore
                    if(GDPacket.type == GameDataPacketType.Spawn) {
                        this.GameObjects.push(<IGameObject>GDPacket)
                    }
                })
            default:
                this.connections.filter(conn => addr2str(conn.address) != addr2str(connection.address)).forEach(otherClient => {
                    // @ts-ignore
                    otherClient.send(packet.type, packet)
                })
                break;
        }
    }
    handleNewConnection(connection: Connection) {
        if(!this.host) connection.player.isHost = true;
        this.connections.forEach(conn => {
            conn.send("PlayerJoinedGame", {
                RoomCode: this.code,
                PlayerClientID: connection.ID,
                HostClientID: this.host.ID
            })
        })
        this.connections.push(connection);
    }
}

export default Room;